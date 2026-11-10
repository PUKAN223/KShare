import { prisma, Room as DbRoom } from "@kshare/database";
import { RoomStatus, UserRole, formatRoomCode } from "@kshare/protocol";

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

declare global {
  // eslint-disable-next-line no-var
  var __kshareRooms: Map<string, StoredRoom> | undefined;
}

const memoryRooms = globalThis.__kshareRooms ?? new Map<string, StoredRoom>();
globalThis.__kshareRooms = memoryRooms;

export function normalizeRoomCode(raw: string): string {
  const trimmed = (raw || "").toUpperCase().trim().replace(/\s+/g, "");
  const alnum = trimmed.replace(/[^A-Z0-9]/g, "");
  if (alnum.length === 7) {
    return formatRoomCode(alnum);
  }
  return trimmed;
}

export function getCandidateCodes(raw: string): string[] {
  const trimmed = (raw || "").toUpperCase().trim().replace(/\s+/g, "");
  const alnum = trimmed.replace(/[^A-Z0-9]/g, "");
  const formatted = alnum.length >= 4 ? formatRoomCode(alnum) : trimmed;
  return Array.from(new Set([formatted, trimmed, alnum].filter(Boolean)));
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

function dbRoomToStoredRoom(row: DbRoom): StoredRoom {
  const defaults = getDefaultRoomSettings(row.code);
  let parsedSettings: Partial<RoomHostSettings> = {};
  let parsedParticipants: Record<string, ViewerParticipant> = {};

  try {
    if (row.settingsJson) {
      parsedSettings = JSON.parse(row.settingsJson);
    }
  } catch {
    // ignore
  }

  try {
    if (row.participantsJson) {
      parsedParticipants = JSON.parse(row.participantsJson);
    }
  } catch {
    // ignore
  }

  const now = Date.now();
  let activeCount = 0;
  for (const [id, p] of Object.entries(parsedParticipants)) {
    if (!p.kicked && now - p.lastSeenAt < 35000) {
      activeCount++;
    } else if (now - p.lastSeenAt >= 120000) {
      delete parsedParticipants[id];
    }
  }

  const stored: StoredRoom = {
    id: row.id,
    code: row.code,
    name: row.name,
    subject: row.subject || "ทั่วไป",
    ownerId: row.ownerId || undefined,
    status: (row.status as RoomStatus) || RoomStatus.IDLE,
    hostToken: row.hostToken,
    viewerTokens: [],
    participants: parsedParticipants,
    settings: {
      ...defaults,
      ...parsedSettings,
      watermark: {
        ...defaults.watermark,
        ...(parsedSettings.watermark || {})
      }
    },
    createdAt: row.createdAt.getTime(),
    lastActiveAt: row.lastActiveAt.getTime(),
    activeViewersCount: activeCount,
    currentStreamId: row.currentStreamId || undefined,
    thumbnailDataUrl: row.thumbnailDataUrl || undefined
  };

  memoryRooms.set(stored.code, stored);
  return stored;
}

export const RoomStore = {
  async create(params: {
    code: string;
    name: string;
    subject?: string;
    ownerId?: string;
    hostToken?: string;
    initialSettings?: Partial<RoomHostSettings>;
  }): Promise<StoredRoom> {
    const normalizedCode = normalizeRoomCode(params.code);
    const hostToken =
      params.hostToken && params.hostToken.startsWith("hst_")
        ? params.hostToken
        : "hst_" + Math.random().toString(36).substring(2, 12);
    const defaults = getDefaultRoomSettings(normalizedCode);

    const settings: RoomHostSettings = {
      ...defaults,
      ...params.initialSettings,
      watermark: {
        ...defaults.watermark,
        ...(params.initialSettings?.watermark || {})
      }
    };

    const roomName = params.name?.trim() || `ห้อง ${normalizedCode}`;
    const subject = params.subject || "ทั่วไป";

    try {
      const created = await prisma.room.upsert({
        where: { code: normalizedCode },
        update: {
          name: roomName,
          subject,
          status: RoomStatus.IDLE,
          hostToken,
          settingsJson: JSON.stringify(settings),
          participantsJson: "{}",
          signalsJson: "{}",
          thumbnailDataUrl: null,
          activeViewersCount: 0,
          lastActiveAt: new Date()
        },
        create: {
          code: normalizedCode,
          name: roomName,
          subject,
          ownerId: params.ownerId || null,
          status: RoomStatus.IDLE,
          hostToken,
          settingsJson: JSON.stringify(settings),
          participantsJson: "{}",
          signalsJson: "{}",
          activeViewersCount: 0
        }
      });

      return dbRoomToStoredRoom(created);
    } catch (err) {
      console.error("Database room create fallback to memory:", err);
      const fallback: StoredRoom = {
        id: "room_" + Math.random().toString(36).substring(2, 10),
        code: normalizedCode,
        name: roomName,
        subject,
        ownerId: params.ownerId,
        status: RoomStatus.IDLE,
        hostToken,
        viewerTokens: [],
        participants: {},
        settings,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        activeViewersCount: 0
      };
      memoryRooms.set(normalizedCode, fallback);
      return fallback;
    }
  },

  async findByCode(code: string): Promise<StoredRoom | undefined> {
    const candidates = getCandidateCodes(code);
    if (candidates.length === 0) return undefined;

    try {
      const row = await prisma.room.findFirst({
        where: {
          code: { in: candidates }
        }
      });
      if (row) {
        return dbRoomToStoredRoom(row);
      }
    } catch (err) {
      console.error("Database findByCode error, checking memory:", err);
    }

    for (const c of candidates) {
      const mem = memoryRooms.get(c);
      if (mem) return mem;
    }
    return undefined;
  },

  async getAll(): Promise<StoredRoom[]> {
    try {
      const rows = await prisma.room.findMany({
        orderBy: { createdAt: "desc" },
        take: 30
      });
      return rows.map(dbRoomToStoredRoom);
    } catch (err) {
      console.error("Database getAll error, falling back to memory:", err);
      return Array.from(memoryRooms.values()).sort((a, b) => b.createdAt - a.createdAt);
    }
  },

  async deleteRoom(code: string, hostToken?: string): Promise<boolean> {
    const room = await this.findByCode(code);
    if (!room) return false;
    if (hostToken && room.hostToken !== hostToken) return false;

    memoryRooms.delete(room.code);
    try {
      await prisma.room.delete({
        where: { code: room.code }
      });
      return true;
    } catch (err) {
      console.error("Database deleteRoom error:", err);
      return true;
    }
  },

  async updateRoom(
    code: string,
    updates: {
      status?: RoomStatus;
      streamId?: string;
      name?: string;
      subject?: string;
      thumbnailDataUrl?: string | null;
      settings?: Partial<RoomHostSettings>;
    }
  ): Promise<StoredRoom | undefined> {
    const room = await this.findByCode(code);
    if (!room) return undefined;

    if (updates.status !== undefined) {
      room.status = updates.status;
      if (updates.status === RoomStatus.IDLE) {
        room.thumbnailDataUrl = undefined;
      }
    }
    if (updates.streamId !== undefined) room.currentStreamId = updates.streamId;
    if (updates.name !== undefined && updates.name.trim()) room.name = updates.name.trim();
    if (updates.subject !== undefined) room.subject = updates.subject;
    if (updates.thumbnailDataUrl !== undefined) {
      room.thumbnailDataUrl = updates.thumbnailDataUrl || undefined;
    }
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
    memoryRooms.set(room.code, room);

    try {
      const updated = await prisma.room.update({
        where: { code: room.code },
        data: {
          status: room.status,
          currentStreamId: room.currentStreamId ?? null,
          name: room.name,
          subject: room.subject,
          thumbnailDataUrl: room.thumbnailDataUrl ?? null,
          settingsJson: JSON.stringify(room.settings),
          lastActiveAt: new Date()
        }
      });
      return dbRoomToStoredRoom(updated);
    } catch (err) {
      console.error("Database updateRoom error:", err);
      return room;
    }
  },

  async upsertParticipant(
    code: string,
    participant: { viewerId: string; displayName?: string; deviceHint?: string }
  ): Promise<{ allowed: boolean; reason?: string; room?: StoredRoom }> {
    const room = await this.findByCode(code);
    if (!room) return { allowed: false, reason: "ไม่พบห้องนี้ในระบบ" };

    const existing = room.participants[participant.viewerId];
    if (existing?.kicked) {
      return { allowed: false, reason: "คุณถูกนำออกจากห้องนี้" };
    }

    if (!existing && room.settings.isLocked) {
      return { allowed: false, reason: "ห้องถูกล็อกชั่วคราว" };
    }

    const now = Date.now();
    const activeList = Object.values(room.participants).filter(
      (p) => !p.kicked && now - p.lastSeenAt < 35000
    );
    if (!existing && activeList.length >= room.settings.maxViewers) {
      return { allowed: false, reason: `ห้องเต็มแล้ว (จำกัด ${room.settings.maxViewers} คน)` };
    }

    room.participants[participant.viewerId] = {
      viewerId: participant.viewerId,
      displayName:
        participant.displayName?.trim() ||
        existing?.displayName ||
        `คนดู #${Object.keys(room.participants).length + 1}`,
      deviceHint: participant.deviceHint || existing?.deviceHint || "Browser",
      joinedAt: existing?.joinedAt || now,
      lastSeenAt: now,
      kicked: false
    };

    const newActiveCount = Object.values(room.participants).filter(
      (p) => !p.kicked && now - p.lastSeenAt < 35000
    ).length;
    room.activeViewersCount = newActiveCount;
    room.lastActiveAt = now;
    memoryRooms.set(room.code, room);

    try {
      await prisma.room.update({
        where: { code: room.code },
        data: {
          participantsJson: JSON.stringify(room.participants),
          activeViewersCount: newActiveCount,
          lastActiveAt: new Date()
        }
      });
    } catch (err) {
      console.error("Database upsertParticipant error:", err);
    }

    return { allowed: true, room };
  },

  async kickParticipant(code: string, viewerId: string): Promise<boolean> {
    const room = await this.findByCode(code);
    if (!room || !room.participants[viewerId]) return false;
    room.participants[viewerId].kicked = true;

    const now = Date.now();
    const newActiveCount = Object.values(room.participants).filter(
      (p) => !p.kicked && now - p.lastSeenAt < 35000
    ).length;
    room.activeViewersCount = newActiveCount;
    memoryRooms.set(room.code, room);

    try {
      await prisma.room.update({
        where: { code: room.code },
        data: {
          participantsJson: JSON.stringify(room.participants),
          activeViewersCount: newActiveCount,
          lastActiveAt: new Date()
        }
      });
    } catch (err) {
      console.error("Database kickParticipant error:", err);
    }
    return true;
  },

  async verifyAccess(
    code: string,
    token?: string
  ): Promise<{ valid: boolean; role: UserRole; room?: StoredRoom }> {
    let room = await this.findByCode(code);

    // Self-heal if host reconnects with a valid hostToken
    if (!room && token && token.startsWith("hst_")) {
      room = await this.create({
        code,
        name: `ห้อง ${normalizeRoomCode(code)}`,
        hostToken: token
      });
    }

    if (!room) return { valid: false, role: UserRole.VIEWER };

    if (token && token === room.hostToken) {
      return { valid: true, role: UserRole.HOST, room };
    }

    return { valid: true, role: UserRole.VIEWER, room };
  }
};
