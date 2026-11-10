import { PeerSignalSlot } from "@/app/api/rooms/[code]/signal/route";

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

export interface LiveStreamMetrics {
  bitrateKbps: number;
  frameRate: number;
  width: number;
  height: number;
  rttMs: number;
  connectedPeers: number;
  transportMode: "P2P Direct" | "TURN Relay";
}

export interface HostEncodingOptions {
  maxBitrateKbps: number;
  degradationPreference: "maintain-resolution" | "maintain-framerate" | "balanced";
}

interface HostPeerInstance {
  viewerId: string;
  sessionEpoch: number;
  pc: RTCPeerConnection;
  hasAnswered: boolean;
  addedCandidateIndices: number;
  isCreatingOffer: boolean;
}

/**
 * Wait briefly (up to timeoutMs) for ICE candidates to gather so they are
 * bundled into pc.localDescription and sent in ONE atomic HTTP request
 * instead of 15 parallel requests that race on serverless databases.
 */
function waitForIceGathering(
  pc: RTCPeerConnection,
  timeoutMs = 450
): Promise<RTCIceCandidateInit[]> {
  return new Promise((resolve) => {
    const collected: RTCIceCandidateInit[] = [];
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(collected);
    };

    const timer = setTimeout(finish, timeoutMs);

    pc.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        collected.push(event.candidate.toJSON());
      } else {
        // null candidate means ICE gathering is complete
        finish();
      }
    });

    if (pc.iceGatheringState === "complete") {
      finish();
    }
  });
}

export class WebRTCHostPeer {
  private roomCode: string;
  private stream: MediaStream;
  private peers: Map<string, HostPeerInstance> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private statsTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isClosed = false;
  private lastBytesSent = 0;
  private lastStatsTimestamp = 0;
  private encodingOptions: HostEncodingOptions = {
    maxBitrateKbps: 6000,
    degradationPreference: "maintain-resolution"
  };
  private onStateChangeCb?: (state: string, connectedCount: number) => void;
  private onMetricsCb?: (metrics: LiveStreamMetrics) => void;

  constructor(
    roomCode: string,
    stream: MediaStream,
    onStateChange?: (state: string, connectedCount: number) => void,
    onMetrics?: (metrics: LiveStreamMetrics) => void,
    initialEncoding?: Partial<HostEncodingOptions>
  ) {
    this.roomCode = roomCode;
    this.stream = stream;
    this.onStateChangeCb = onStateChange;
    this.onMetricsCb = onMetrics;
    if (initialEncoding) {
      this.encodingOptions = { ...this.encodingOptions, ...initialEncoding };
    }
  }

  public async start(): Promise<void> {
    this.isClosed = false;
    await fetch(`/api/rooms/${this.roomCode}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "host",
        type: "broadcast-start"
      })
    }).catch(() => {});

    this.startPolling();
    this.startStatsLoop();
  }

  public async updateEncodingParameters(
    options: Partial<HostEncodingOptions>
  ): Promise<void> {
    this.encodingOptions = { ...this.encodingOptions, ...options };

    for (const instance of this.peers.values()) {
      await this.applySenderParameters(instance.pc);
    }
  }

  private async applySenderParameters(pc: RTCPeerConnection): Promise<void> {
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track?.kind === "video") {
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate =
            this.encodingOptions.maxBitrateKbps * 1000;
          params.degradationPreference =
            this.encodingOptions.degradationPreference;
          await sender.setParameters(params);
        } catch {
          // ignore
        }
      }
    }
  }

  public async syncStreamTracks(stream: MediaStream): Promise<void> {
    this.stream = stream;
    const videoTrack = stream.getVideoTracks()[0] || null;
    const audioTrack = stream.getAudioTracks()[0] || null;

    for (const instance of this.peers.values()) {
      const senders = instance.pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === "video");
      const audioSender = senders.find((s) => s.track?.kind === "audio");

      if (videoSender && videoTrack) {
        await videoSender.replaceTrack(videoTrack).catch(() => {});
      }
      if (audioSender && audioTrack) {
        await audioSender.replaceTrack(audioTrack).catch(() => {});
      } else if (!audioSender && audioTrack) {
        try {
          instance.pc.addTrack(audioTrack, stream);
        } catch {
          // ignore
        }
      }
    }
  }

  private async createOfferForViewer(
    viewerId: string,
    sessionEpoch: number
  ): Promise<void> {
    const existing = this.peers.get(viewerId);
    if (existing) {
      if (existing.isCreatingOffer && existing.sessionEpoch === sessionEpoch) {
        return;
      }
      try {
        existing.pc.close();
      } catch {
        // ignore
      }
      this.peers.delete(viewerId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const instance: HostPeerInstance = {
      viewerId,
      sessionEpoch,
      pc,
      hasAnswered: false,
      addedCandidateIndices: 0,
      isCreatingOffer: true
    };
    this.peers.set(viewerId, instance);

    pc.oniceconnectionstatechange = () => {
      this.notifyAggregateState();
    };

    this.stream.getTracks().forEach((track) => {
      pc.addTrack(track, this.stream);
    });

    await this.applySenderParameters(pc);

    const gatherPromise = waitForIceGathering(pc, 450);

    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });
    await pc.setLocalDescription(offer);

    const gatheredCandidates = await gatherPromise;
    const finalSdp = pc.localDescription || offer;

    // Buffer any late trickle candidates and flush once after 700ms
    const lateCandidates: RTCIceCandidateInit[] = [];
    let flushTimer: NodeJS.Timeout | null = null;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        lateCandidates.push(event.candidate.toJSON());
        if (!flushTimer) {
          flushTimer = setTimeout(async () => {
            flushTimer = null;
            if (lateCandidates.length === 0 || this.isClosed) return;
            const batch = lateCandidates.splice(0, lateCandidates.length);
            await fetch(`/api/rooms/${this.roomCode}/signal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role: "host",
                viewerId,
                candidates: batch
              })
            }).catch(() => {});
          }, 700);
        }
      }
    };

    await fetch(`/api/rooms/${this.roomCode}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "host",
        viewerId,
        sessionEpoch,
        type: "offer",
        sdp: { type: finalSdp.type, sdp: finalSdp.sdp },
        candidates: gatheredCandidates
      })
    }).catch(() => {});

    instance.isCreatingOffer = false;
  }

  private notifyAggregateState(): void {
    let connectedCount = 0;
    let latestState = "waiting";
    for (const inst of this.peers.values()) {
      const st = inst.pc.iceConnectionState;
      if (st === "connected" || st === "completed") {
        connectedCount++;
        latestState = "connected";
      } else if (st === "checking" && latestState !== "connected") {
        latestState = "connecting";
      } else if (st === "disconnected" && latestState !== "connected") {
        latestState = "disconnected";
      }
    }
    this.onStateChangeCb?.(latestState, connectedCount);
  }

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    const pollOnce = async () => {
      if (this.isPolling || this.isClosed) return;
      this.isPolling = true;
      try {
        const res = await fetch(`/api/rooms/${this.roomCode}/signal?role=host`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = await res.json();
        const slots = (data.slots || {}) as Record<string, PeerSignalSlot>;

        for (const [viewerId, slot] of Object.entries(slots)) {
          const existing = this.peers.get(viewerId);

          if (
            slot.needsOffer ||
            !existing ||
            existing.sessionEpoch !== slot.sessionEpoch
          ) {
            await this.createOfferForViewer(viewerId, slot.sessionEpoch);
            continue;
          }

          if (slot.answer && !existing.hasAnswered && !existing.isCreatingOffer) {
            existing.hasAnswered = true;
            try {
              await existing.pc.setRemoteDescription(
                new RTCSessionDescription(slot.answer)
              );
            } catch {
              // ignore
            }
          }

          if (
            existing.hasAnswered &&
            Array.isArray(slot.viewerCandidates) &&
            slot.viewerCandidates.length > existing.addedCandidateIndices
          ) {
            const newCands = slot.viewerCandidates.slice(
              existing.addedCandidateIndices
            );
            existing.addedCandidateIndices = slot.viewerCandidates.length;
            for (const cand of newCands) {
              try {
                await existing.pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // ignore
      } finally {
        this.isPolling = false;
      }
    };

    pollOnce();
    this.pollTimer = setInterval(pollOnce, 1000);
  }

  private startStatsLoop(): void {
    if (this.statsTimer) clearInterval(this.statsTimer);

    this.statsTimer = setInterval(async () => {
      const videoTrack = this.stream.getVideoTracks()[0];
      const trackSettings = videoTrack?.getSettings();
      let connectedPeers = 0;
      let activePc: RTCPeerConnection | null = null;

      for (const inst of this.peers.values()) {
        if (
          inst.pc.iceConnectionState === "connected" ||
          inst.pc.iceConnectionState === "completed"
        ) {
          connectedPeers++;
          if (!activePc) activePc = inst.pc;
        }
      }

      let bitrateKbps = 0;
      let rttMs = 14;
      let frameRate = Math.round(trackSettings?.frameRate || 60);
      let width = trackSettings?.width || 1920;
      let height = trackSettings?.height || 1080;
      let transportMode: "P2P Direct" | "TURN Relay" = "P2P Direct";

      if (activePc) {
        try {
          const report = await activePc.getStats();
          report.forEach((stat) => {
            if (stat.type === "outbound-rtp" && stat.kind === "video") {
              const now = stat.timestamp;
              const bytes = stat.bytesSent || 0;
              if (
                this.lastStatsTimestamp > 0 &&
                now > this.lastStatsTimestamp
              ) {
                const deltaBytes = bytes - this.lastBytesSent;
                const deltaSec = (now - this.lastStatsTimestamp) / 1000;
                if (deltaBytes >= 0 && deltaSec > 0) {
                  bitrateKbps = Math.round((deltaBytes * 8) / 1000 / deltaSec);
                }
              }
              this.lastBytesSent = bytes;
              this.lastStatsTimestamp = now;
              if (stat.framesPerSecond)
                frameRate = Math.round(stat.framesPerSecond);
              if (stat.frameWidth) width = stat.frameWidth;
              if (stat.frameHeight) height = stat.frameHeight;
            }
            if (stat.type === "candidate-pair" && stat.state === "succeeded") {
              if (typeof stat.currentRoundTripTime === "number") {
                rttMs = Math.max(
                  1,
                  Math.round(stat.currentRoundTripTime * 1000)
                );
              }
            }
            if (
              stat.type === "local-candidate" &&
              stat.candidateType === "relay"
            ) {
              transportMode = "TURN Relay";
            }
          });
        } catch {
          // ignore
        }
      }

      this.onMetricsCb?.({
        bitrateKbps,
        frameRate,
        width,
        height,
        rttMs,
        connectedPeers,
        transportMode
      });
    }, 2000);
  }

  public close(): void {
    this.isClosed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    for (const inst of this.peers.values()) {
      try {
        inst.pc.close();
      } catch {
        // ignore
      }
    }
    this.peers.clear();

    fetch(`/api/rooms/${this.roomCode}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true })
    }).catch(() => {});
  }
}

export class WebRTCViewerPeer {
  private pc: RTCPeerConnection | null = null;
  private roomCode: string;
  public readonly viewerId: string;
  private onStreamCb: (stream: MediaStream) => void;
  private onStateChangeCb?: (state: string) => void;
  private onMetricsCb?: (metrics: LiveStreamMetrics) => void;
  private pollTimer: NodeJS.Timeout | null = null;
  private statsTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isHandlingOffer = false;
  private isClosed = false;
  private processedEpoch = 0;
  private addedHostCandidates = 0;
  private lastBytesReceived = 0;
  private lastStatsTimestamp = 0;

  constructor(
    roomCode: string,
    viewerId: string,
    onStream: (stream: MediaStream) => void,
    onStateChange?: (state: string) => void,
    onMetrics?: (metrics: LiveStreamMetrics) => void
  ) {
    this.roomCode = roomCode;
    this.viewerId = viewerId;
    this.onStreamCb = onStream;
    this.onStateChangeCb = onStateChange;
    this.onMetricsCb = onMetrics;
  }

  public async start(): Promise<void> {
    this.isClosed = false;
    await this.requestFreshOffer();
    this.pollForOffer();
    this.startStatsLoop();
  }

  public async requestFreshOffer(): Promise<void> {
    this.processedEpoch = 0;
    this.addedHostCandidates = 0;
    try {
      await fetch(`/api/rooms/${this.roomCode}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "viewer",
          viewerId: this.viewerId,
          type: "request-offer"
        })
      });
    } catch {
      // ignore
    }
  }

  private pollForOffer(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    const pollOnce = async () => {
      if (this.isPolling || this.isHandlingOffer || this.isClosed) return;
      this.isPolling = true;
      try {
        // Stop rapid polling once WebRTC peer connection is already connected!
        const currentIce = this.pc?.iceConnectionState;
        if (currentIce === "connected" || currentIce === "completed") {
          return;
        }

        const res = await fetch(
          `/api/rooms/${this.roomCode}/signal?viewerId=${encodeURIComponent(
            this.viewerId
          )}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (!data.hostActive) {
          this.processedEpoch = 0;
          return;
        }

        if (data.offer && data.sessionEpoch !== this.processedEpoch) {
          this.processedEpoch = data.sessionEpoch;
          this.addedHostCandidates = 0;
          await this.handleOffer(
            data.offer,
            data.hostCandidates || [],
            data.sessionEpoch
          );
        } else if (
          this.pc &&
          this.processedEpoch === data.sessionEpoch &&
          Array.isArray(data.hostCandidates) &&
          data.hostCandidates.length > this.addedHostCandidates
        ) {
          const newCands = data.hostCandidates.slice(this.addedHostCandidates);
          this.addedHostCandidates = data.hostCandidates.length;
          for (const cand of newCands) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      } finally {
        this.isPolling = false;
      }
    };

    pollOnce();
    this.pollTimer = setInterval(pollOnce, 1000);
  }

  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    hostCandidates: RTCIceCandidateInit[],
    sessionEpoch: number
  ): Promise<void> {
    this.isHandlingOffer = true;
    try {
      if (this.pc) {
        try {
          this.pc.close();
        } catch {
          // ignore
        }
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      this.pc = pc;

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState || "unknown";
        this.onStateChangeCb?.(state);
        if (state === "failed") {
          this.requestFreshOffer().catch(() => {});
        }
      };

      const inboundStream = new MediaStream();
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.onStreamCb(event.streams[0]);
        } else if (event.track) {
          inboundStream.addTrack(event.track);
          this.onStreamCb(inboundStream);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      this.addedHostCandidates = hostCandidates.length;
      for (const cand of hostCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // ignore
        }
      }

      const gatherPromise = waitForIceGathering(pc, 450);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const gatheredCandidates = await gatherPromise;
      const finalAnswer = pc.localDescription || answer;

      // Batch any late viewer candidates
      const lateCandidates: RTCIceCandidateInit[] = [];
      let flushTimer: NodeJS.Timeout | null = null;
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          lateCandidates.push(event.candidate.toJSON());
          if (!flushTimer) {
            flushTimer = setTimeout(async () => {
              flushTimer = null;
              if (lateCandidates.length === 0 || this.isClosed) return;
              const batch = lateCandidates.splice(0, lateCandidates.length);
              await fetch(`/api/rooms/${this.roomCode}/signal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: "viewer",
                  viewerId: this.viewerId,
                  sessionEpoch,
                  candidates: batch
                })
              }).catch(() => {});
            }, 700);
          }
        }
      };

      await fetch(`/api/rooms/${this.roomCode}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "viewer",
          viewerId: this.viewerId,
          sessionEpoch,
          type: "answer",
          sdp: { type: finalAnswer.type, sdp: finalAnswer.sdp },
          candidates: gatheredCandidates
        })
      });
    } finally {
      this.isHandlingOffer = false;
    }
  }

  private startStatsLoop(): void {
    if (this.statsTimer) clearInterval(this.statsTimer);

    this.statsTimer = setInterval(async () => {
      if (!this.pc) return;
      const state = this.pc.iceConnectionState;
      if (state !== "connected" && state !== "completed") return;

      let bitrateKbps = 0;
      let frameRate = 60;
      let width = 1920;
      let height = 1080;
      let rttMs = 15;
      let transportMode: "P2P Direct" | "TURN Relay" = "P2P Direct";

      try {
        const report = await this.pc.getStats();
        report.forEach((stat) => {
          if (stat.type === "inbound-rtp" && stat.kind === "video") {
            const now = stat.timestamp;
            const bytes = stat.bytesReceived || 0;
            if (this.lastStatsTimestamp > 0 && now > this.lastStatsTimestamp) {
              const deltaBytes = bytes - this.lastBytesReceived;
              const deltaSec = (now - this.lastStatsTimestamp) / 1000;
              if (deltaBytes >= 0 && deltaSec > 0) {
                bitrateKbps = Math.round((deltaBytes * 8) / 1000 / deltaSec);
              }
            }
            this.lastBytesReceived = bytes;
            this.lastStatsTimestamp = now;
            if (stat.framesPerSecond)
              frameRate = Math.round(stat.framesPerSecond);
            if (stat.frameWidth) width = stat.frameWidth;
            if (stat.frameHeight) height = stat.frameHeight;
          }
          if (stat.type === "candidate-pair" && stat.state === "succeeded") {
            if (typeof stat.currentRoundTripTime === "number") {
              rttMs = Math.max(
                1,
                Math.round(stat.currentRoundTripTime * 1000)
              );
            }
          }
          if (
            stat.type === "remote-candidate" &&
            stat.candidateType === "relay"
          ) {
            transportMode = "TURN Relay";
          }
        });
      } catch {
        // ignore
      }

      this.onMetricsCb?.({
        bitrateKbps,
        frameRate,
        width,
        height,
        rttMs,
        connectedPeers: 1,
        transportMode
      });
    }, 2000);
  }

  public close(): void {
    this.isClosed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
  }
}
