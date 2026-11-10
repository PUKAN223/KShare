export enum RoomStatus {
  IDLE = "IDLE",
  WAITING = "WAITING",
  PREPARING = "PREPARING",
  ACTIVE = "ACTIVE",
  LIVE = "LIVE",
  CLOSED = "CLOSED"
}

export enum UserRole {
  HOST = "HOST",
  VIEWER = "VIEWER"
}

export enum SessionStatus {
  INITIALIZING = "INITIALIZING",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  DISCONNECTED = "DISCONNECTED",
  ENDED = "ENDED",
  FAILED = "FAILED"
}

export enum IceTransportType {
  DIRECT_P2P = "DIRECT_P2P",
  TURN_RELAY = "TURN_RELAY",
  UNKNOWN = "UNKNOWN"
}

export interface MediaQualityStats {
  resolutionWidth?: number;
  resolutionHeight?: number;
  frameRate?: number;
  bitrateKbps?: number;
  latencyMs?: number;
  packetLossPercent?: number;
  transportType?: IceTransportType;
}

export interface RoomMetadata {
  id: string;
  code: string;
  name: string;
  ownerId?: string | null;
  status: RoomStatus;
  maxViewers: number;
  createdAt: string;
  expiresAt?: string | null;
}

export interface PeerSessionInfo {
  sessionId: string;
  roomId: string;
  role: UserRole;
  joinedAt: string;
  status: SessionStatus;
  userDisplayName: string;
}

/**
 * Format and parse clean Room Codes
 * Example format: "KSH-8492" or "ROOM-1234"
 */
export function formatRoomCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
}

export function isValidRoomCode(code: string): boolean {
  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length >= 6 && cleaned.length <= 8;
}

export function generateRoomCode(prefix = "KSH"): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Remove ambiguous characters like 0, O, 1, I
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
}
