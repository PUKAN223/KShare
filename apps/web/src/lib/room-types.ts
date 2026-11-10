import { RoomStatus } from "@kshare/protocol";

export type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface RoomWatermarkConfig {
  enabled: boolean;
  showLogo: boolean;
  text: string;
  position: WatermarkPosition;
  opacity: number;
}

export interface RoomHostSettings {
  resolution: "720p" | "1080p" | "1440p" | "4k";
  frameRate: number;
  maxBitrateKbps: number;
  contentHint: "detail" | "motion";
  degradationPreference: "maintain-resolution" | "maintain-framerate" | "balanced";
  isLocked: boolean;
  pinCode: string;
  maxViewers: number;
  isPaused: boolean;
  rotation?: number;
  watermark: RoomWatermarkConfig;
}

export interface ViewerParticipant {
  viewerId: string;
  displayName: string;
  deviceHint: string;
  joinedAt: number;
  lastSeenAt: number;
  kicked?: boolean;
}

export interface StoredRoom {
  id: string;
  code: string;
  name: string;
  subject: string;
  ownerId?: string;
  status: RoomStatus;
  hostToken: string;
  viewerTokens: string[];
  participants: Record<string, ViewerParticipant>;
  settings: RoomHostSettings;
  createdAt: number;
  lastActiveAt: number;
  activeViewersCount: number;
  currentStreamId?: string;
  thumbnailDataUrl?: string;
}

export function getDefaultRoomSettings(code: string): RoomHostSettings {
  return {
    resolution: "1080p",
    frameRate: 60,
    maxBitrateKbps: 6000,
    contentHint: "detail",
    degradationPreference: "maintain-resolution",
    isLocked: false,
    pinCode: "",
    maxViewers: 30,
    isPaused: false,
    rotation: 0,
    watermark: {
      enabled: true,
      showLogo: true,
      text: code,
      position: "bottom-right",
      opacity: 75
    }
  };
}
