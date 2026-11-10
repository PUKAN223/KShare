import {
  SessionStatus,
  MediaQualityStats,
  UserRole
} from "@kshare/protocol";

export interface ConnectOptions {
  roomCode: string;
  role: UserRole;
  password?: string;
  userId?: string;
  displayName?: string;
  iceServers?: RTCIceServer[];
}

export type StateChangeHandler = (status: SessionStatus, detail?: string) => void;
export type StatsUpdateHandler = (stats: MediaQualityStats) => void;
export type PeerEventHandler = (peerId: string, role: UserRole) => void;
export type ErrorHandler = (error: Error) => void;

export interface ScreenShareAdapterEvents {
  onStateChange(handler: StateChangeHandler): void;
  onStatsUpdate(handler: StatsUpdateHandler): void;
  onPeerJoin(handler: PeerEventHandler): void;
  onPeerLeave(handler: PeerEventHandler): void;
  onError(handler: ErrorHandler): void;
}

export interface ScreenShareAdapter extends ScreenShareAdapterEvents {
  readonly id: string;
  getStatus(): SessionStatus;
  connect(options: ConnectOptions): Promise<void>;
  publish(stream: MediaStream): Promise<void>;
  view(streamId: string): Promise<MediaStream | null>;
  disconnect(): Promise<void>;
}

export type AdapterProviderType = "vdo-ninja" | "native-webrtc" | "mock";

export interface AdapterFactoryOptions {
  provider: AdapterProviderType;
  customConfig?: Record<string, unknown>;
}

export abstract class BaseScreenShareAdapter implements ScreenShareAdapter {
  public abstract readonly id: string;
  protected status: SessionStatus = SessionStatus.INITIALIZING;
  protected stateHandlers: Set<StateChangeHandler> = new Set();
  protected statsHandlers: Set<StatsUpdateHandler> = new Set();
  protected peerJoinHandlers: Set<PeerEventHandler> = new Set();
  protected peerLeaveHandlers: Set<PeerEventHandler> = new Set();
  protected errorHandlers: Set<ErrorHandler> = new Set();

  public getStatus(): SessionStatus {
    return this.status;
  }

  protected setStatus(status: SessionStatus, detail?: string) {
    this.status = status;
    this.stateHandlers.forEach((handler) => {
      try {
        handler(status, detail);
      } catch (e) {
        console.error("StateChangeHandler error:", e);
      }
    });
  }

  protected emitStats(stats: MediaQualityStats) {
    this.statsHandlers.forEach((handler) => {
      try {
        handler(stats);
      } catch (e) {
        console.error("StatsUpdateHandler error:", e);
      }
    });
  }

  protected emitPeerJoin(peerId: string, role: UserRole) {
    this.peerJoinHandlers.forEach((handler) => {
      try {
        handler(peerId, role);
      } catch (e) {
        console.error("PeerJoinHandler error:", e);
      }
    });
  }

  protected emitPeerLeave(peerId: string, role: UserRole) {
    this.peerLeaveHandlers.forEach((handler) => {
      try {
        handler(peerId, role);
      } catch (e) {
        console.error("PeerLeaveHandler error:", e);
      }
    });
  }

  protected emitError(err: Error) {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(err);
      } catch (e) {
        console.error("ErrorHandler error:", e);
      }
    });
  }

  public onStateChange(handler: StateChangeHandler): void {
    this.stateHandlers.add(handler);
  }

  public onStatsUpdate(handler: StatsUpdateHandler): void {
    this.statsHandlers.add(handler);
  }

  public onPeerJoin(handler: PeerEventHandler): void {
    this.peerJoinHandlers.add(handler);
  }

  public onPeerLeave(handler: PeerEventHandler): void {
    this.peerLeaveHandlers.add(handler);
  }

  public onError(handler: ErrorHandler): void {
    this.errorHandlers.add(handler);
  }

  public abstract connect(options: ConnectOptions): Promise<void>;
  public abstract publish(stream: MediaStream): Promise<void>;
  public abstract view(streamId: string): Promise<MediaStream | null>;
  public abstract disconnect(): Promise<void>;
}
