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
  }
];

export class WebRTCHostPeer {
  private pc: RTCPeerConnection | null = null;
  private roomCode: string;
  private stream: MediaStream;
  private pollTimer: NodeJS.Timeout | null = null;
  private hasAnswered = false;
  private onStateChangeCb?: (state: string) => void;

  constructor(
    roomCode: string,
    stream: MediaStream,
    onStateChange?: (state: string) => void
  ) {
    this.roomCode = roomCode;
    this.stream = stream;
    this.onStateChangeCb = onStateChange;
  }

  public async start(): Promise<void> {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState || "unknown";
      this.onStateChangeCb?.(state);
    };

    // Send candidates to signaling server
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await fetch(`/api/rooms/${this.roomCode}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "host",
              candidate: event.candidate.toJSON()
            })
          });
        } catch {
          // ignore
        }
      }
    };

    // Add screen stream tracks
    this.stream.getTracks().forEach((track) => {
      if (this.pc) {
        this.pc.addTrack(track, this.stream);
      }
    });

    // Create & post offer
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });
    await this.pc.setLocalDescription(offer);

    await fetch(`/api/rooms/${this.roomCode}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "host",
        type: "offer",
        sdp: { type: offer.type, sdp: offer.sdp }
      })
    });

    // Start polling for Viewer Answer
    this.pollForAnswer();
  }

  private pollForAnswer(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(async () => {
      if (!this.pc) return;

      try {
        const res = await fetch(`/api/rooms/${this.roomCode}/signal`);
        if (!res.ok) return;
        const data = await res.json();

        // If answer exists and not yet applied
        if (data.answer && !this.hasAnswered) {
          this.hasAnswered = true;
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));

          // Apply viewer ICE candidates
          if (Array.isArray(data.viewerCandidates)) {
            for (const cand of data.viewerCandidates) {
              try {
                await this.pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {
                // ignore
              }
            }
          }
        } else if (data.answer && this.hasAnswered && Array.isArray(data.viewerCandidates)) {
          // Continue adding any late viewer candidates
          for (const cand of data.viewerCandidates) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }, 1000);
  }

  public close(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }

    // Reset signal on server
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
  private onStreamCb: (stream: MediaStream) => void;
  private onStateChangeCb?: (state: string) => void;
  private pollTimer: NodeJS.Timeout | null = null;
  private hasProcessedOffer = false;

  constructor(
    roomCode: string,
    onStream: (stream: MediaStream) => void,
    onStateChange?: (state: string) => void
  ) {
    this.roomCode = roomCode;
    this.onStreamCb = onStream;
    this.onStateChangeCb = onStateChange;
  }

  public start(): void {
    this.pollForOffer();
  }

  private pollForOffer(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${this.roomCode}/signal`);
        if (!res.ok) return;
        const data = await res.json();

        // When host offer is ready and we haven't answered yet
        if (data.offer && !this.hasProcessedOffer) {
          this.hasProcessedOffer = true;
          await this.handleOffer(data.offer, data.hostCandidates || []);
        } else if (!data.offer) {
          // Host stopped sharing or reset
          this.hasProcessedOffer = false;
        }
      } catch {
        // ignore
      }
    }, 1200);
  }

  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    hostCandidates: RTCIceCandidateInit[]
  ): Promise<void> {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
    }

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState || "unknown";
      this.onStateChangeCb?.(state);
    };

    // When remote stream arrives, forward to callback immediately!
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onStreamCb(event.streams[0]);
      }
    };

    // Forward viewer candidates to host via signaling
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await fetch(`/api/rooms/${this.roomCode}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "viewer",
              candidate: event.candidate.toJSON()
            })
          });
        } catch {
          // ignore
        }
      }
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Add any existing host candidates
    for (const cand of hostCandidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore
      }
    }

    // Create & post Answer
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await fetch(`/api/rooms/${this.roomCode}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "viewer",
        type: "answer",
        sdp: { type: answer.type, sdp: answer.sdp }
      })
    });
  }

  public close(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
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
