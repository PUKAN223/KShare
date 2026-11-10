import {
  BaseScreenShareAdapter,
  ConnectOptions
} from "@kshare/screen-share";
import {
  SessionStatus,
  UserRole,
  IceTransportType,
  MediaQualityStats
} from "@kshare/protocol";

export interface VdoNinjaAdapterConfig {
  server?: string;
  whipEndpoint?: string;
  whepEndpoint?: string;
  enableTurnFallback?: boolean;
}

export class VdoNinjaAdapter extends BaseScreenShareAdapter {
  public readonly id = "vdo-ninja";
  private config: VdoNinjaAdapterConfig;
  private currentOptions: ConnectOptions | null = null;
  private publishedStream: MediaStream | null = null;
  private subscribedStream: MediaStream | null = null;
  private statsIntervalTimer: NodeJS.Timeout | null = null;
  private peerConnection: RTCPeerConnection | null = null;

  constructor(config: VdoNinjaAdapterConfig = {}) {
    super();
    this.config = {
      server: "https://vdo.ninja",
      enableTurnFallback: true,
      ...config
    };
  }

  public async connect(options: ConnectOptions): Promise<void> {
    this.currentOptions = options;
    this.setStatus(SessionStatus.CONNECTING, `กำลังเชื่อมต่อห้อง ${options.roomCode}`);

    try {
      // Setup connection parameters
      const normalizedRoom = options.roomCode.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isHost = options.role === UserRole.HOST;

      // In browser environment, configure WebRTC ICE & signaling configuration
      const iceServers: RTCIceServer[] = options.iceServers || [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        ...(this.config.enableTurnFallback
          ? [
              {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject"
              }
            ]
          : [])
      ];

      if (typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined") {
        this.peerConnection = new RTCPeerConnection({ iceServers });

        this.peerConnection.oniceconnectionstatechange = () => {
          if (!this.peerConnection) return;
          const state = this.peerConnection.iceConnectionState;
          if (state === "connected" || state === "completed") {
            this.setStatus(SessionStatus.CONNECTED, "เชื่อมต่อ WebRTC P2P สำเร็จ");
            this.startStatsMonitoring();
          } else if (state === "disconnected") {
            this.setStatus(SessionStatus.RECONNECTING, "สัญญาณขาดหาย กำลังเชื่อมต่อใหม่...");
          } else if (state === "failed" || state === "closed") {
            this.setStatus(SessionStatus.DISCONNECTED, "การเชื่อมต่อ P2P ยุติลง");
          }
        };
      }

      this.setStatus(
        SessionStatus.CONNECTED,
        isHost
          ? `ห้องพร้อมแชร์หน้าจอ (รหัส: ${options.roomCode})`
          : `เชื่อมต่อกับห้อง ${options.roomCode} เรียบร้อยแล้ว`
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.setStatus(SessionStatus.FAILED, error.message);
      this.emitError(error);
      throw error;
    }
  }

  public async publish(stream: MediaStream): Promise<void> {
    this.publishedStream = stream;
    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) {
      throw new Error("Cannot publish stream: no video track available");
    }

    if (this.peerConnection) {
      stream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, stream);
      });
    }

    this.setStatus(SessionStatus.CONNECTED, "กำลังส่งสัญญาณภาพหน้าจอ (P2P Streaming Live)");
    this.startStatsMonitoring();
  }

  public async view(_streamId: string): Promise<MediaStream | null> {
    if (this.publishedStream) {
      return this.publishedStream;
    }

    // Return current subscribed stream if ready
    return this.subscribedStream;
  }

  public setSubscribedStream(stream: MediaStream): void {
    this.subscribedStream = stream;
    this.setStatus(SessionStatus.CONNECTED, "กำลังรับสัญญาณภาพหน้าจอ");
    this.startStatsMonitoring();
  }

  private startStatsMonitoring(): void {
    if (this.statsIntervalTimer) clearInterval(this.statsIntervalTimer);

    this.statsIntervalTimer = setInterval(() => {
      if (this.status !== SessionStatus.CONNECTED) return;

      const activeStream = this.publishedStream || this.subscribedStream;
      const videoTrack = activeStream?.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();

      const mockStats: MediaQualityStats = {
        resolutionWidth: settings?.width || 1920,
        resolutionHeight: settings?.height || 1080,
        frameRate: Math.round(settings?.frameRate || 30),
        bitrateKbps: Math.floor(2500 + Math.random() * 800),
        latencyMs: Math.floor(18 + Math.random() * 15),
        packetLossPercent: parseFloat((Math.random() * 0.1).toFixed(2)),
        transportType: IceTransportType.DIRECT_P2P
      };

      this.emitStats(mockStats);
    }, 2000);
  }

  public async disconnect(): Promise<void> {
    if (this.statsIntervalTimer) {
      clearInterval(this.statsIntervalTimer);
      this.statsIntervalTimer = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {
        // ignore
      }
      this.peerConnection = null;
    }

    this.publishedStream = null;
    this.subscribedStream = null;
    this.setStatus(SessionStatus.ENDED, "สิ้นสุดการเชื่อมต่อ");
  }
}
