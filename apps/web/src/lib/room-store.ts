import { RoomStatus, UserRole } from "@kshare/protocol";

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
}

declare global {
  // eslint-disable-next-line no-var
  var __kshareRooms: Map<string, StoredRoom> | undefined;
}

const rooms = globalThis.__kshareRooms ?? new Map<string, StoredRoom>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__kshareRooms = rooms;
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
    watermark: {
      enabled: true,
      showLogo: true,
      text: code,
      position: "bottom-right",
      opacity: 75
    }
  };
}

export const RoomStore = {
  create(params: {
    code: string;
    name: string;
    subject?: string;
    ownerId?: string;
    initialSettings?: Partial<RoomHostSettings>;
  }): StoredRoom {
    const normalizedCode = params.code.toUpperCase().replace(/\s+/g, "");
    const hostToken = "hst_" + Math.random().toString(36).substring(2, 12);
    const defaults = getDefaultRoomSettings(normalizedCode);

    const room: StoredRoom = {
      id: "room_" + Math.random().toString(36).substring(2, 10),
      code: normalizedCode,
      name: params.name,
      subject: params.subject || "ทั่วไป",
      ownerId: params.ownerId,
      status: RoomStatus.IDLE,
      hostToken,
      viewerTokens: [],
      participants: {},
      settings: {
        ...defaults,
        ...params.initialSettings,
        watermark: {
          ...defaults.watermark,
          ...(params.initialSettings?.watermark || {})
        }
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      activeViewersCount: 0
    };
    rooms.set(normalizedCode, room);
    return room;
  },

  findByCode(code: string): StoredRoom | undefined {
    const normalizedCode = code.toUpperCase().replace(/\s+/g, "");
    const room = rooms.get(normalizedCode);
    if (room) {
      // Prune stale participants (> 25 seconds without heartbeat)
      const now = Date.now();
      let activeCount = 0;
      for (const [id, p] of Object.entries(room.participants)) {
        if (!p.kicked && now - p.lastSeenAt < 25000) {
          activeCount++;
        } else if (now - p.lastSeenAt >= 60000) {
          delete room.participants[id];
        }
      }
      room.activeViewersCount = activeCount;
    }
    return room;
  },

  getAll(): StoredRoom[] {
    return Array.from(rooms.values())
      .map((r) => this.findByCode(r.code)!)
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  deleteRoom(code: string, hostToken?: string): boolean {
    const room = this.findByCode(code);
    if (!room) return false;
    if (hostToken && room.hostToken !== hostToken) return false;
    return rooms.delete(room.code);
  },

  updateRoom(
    code: string,
    updates: {
      status?: RoomStatus;
      streamId?: string;
      name?: string;
      subject?: string;
      settings?: Partial<RoomHostSettings>;
    }
  ): StoredRoom | undefined {
    const room = this.findByCode(code);
    if (!room) return undefined;

    if (updates.status !== undefined) room.status = updates.status;
    if (updates.streamId !== undefined) room.currentStreamId = updates.streamId;
    if (updates.name !== undefined) room.name = updates.name;
    if (updates.subject !== undefined) room.subject = updates.subject;
    if (updates.settings) {
      room.settings = {
        ...room.settings,
        ...updates.settings,
        watermark: {
          ...room.settings.watermark,
          ...(updates.settings.watermark || {})
        }
      };
    }
    room.lastActiveAt = Date.now();
    return room;
  },

  upsertParticipant(
    code: string,
    participant: { viewerId: string; displayName?: string; deviceHint?: string }
  ): { allowed: boolean; reason?: string; room?: StoredRoom } {
    const room = this.findByCode(code);
    if (!room) return { allowed: false, reason: "ไม่พบห้องนี้ในระบบ" };

    const existing = room.participants[participant.viewerId];
    if (existing?.kicked) {
      return { allowed: false, reason: "คุณถูกผู้สอนนำออกจากห้องนี้" };
    }

    if (!existing && room.settings.isLocked) {
      return { allowed: false, reason: "ห้องเรียนถูกล็อกโดยผู้สอนชั่วคราว" };
    }

    const activeList = Object.values(room.participants).filter(
      (p) => !p.kicked && Date.now() - p.lastSeenAt < 25000
    );
    if (!existing && activeList.length >= room.settings.maxViewers) {
      return { allowed: false, reason: `ห้องเต็มแล้ว (จำกัด ${room.settings.maxViewers} คน)` };
    }

    room.participants[participant.viewerId] = {
      viewerId: participant.viewerId,
      displayName:
        participant.displayName?.trim() ||
        existing?.displayName ||
        `ผู้เรียน #${Object.keys(room.participants).length + 1}`,
      deviceHint: participant.deviceHint || existing?.deviceHint || "Browser",
      joinedAt: existing?.joinedAt || Date.now(),
      lastSeenAt: Date.now(),
      kicked: false
    };

    room.lastActiveAt = Date.now();
    this.findByCode(code); // refresh count
    return { allowed: true, room };
  },

  kickParticipant(code: string, viewerId: string): boolean {
    const room = this.findByCode(code);
    if (!room || !room.participants[viewerId]) return false;
    room.participants[viewerId].kicked = true;
    this.findByCode(code);
    return true;
  },

  verifyAccess(
    code: string,
    token?: string
  ): { valid: boolean; role: UserRole; room?: StoredRoom } {
    const room = this.findByCode(code);
    if (!room) return { valid: false, role: UserRole.VIEWER };

    if (token && token === room.hostToken) {
      return { valid: true, role: UserRole.HOST, room };
    }

    return { valid: true, role: UserRole.VIEWER, room };
  }
};
