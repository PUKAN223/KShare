import { RoomStatus, UserRole } from "@kshare/protocol";

export interface StoredRoom {
  id: string;
  code: string;
  name: string;
  ownerId?: string;
  status: RoomStatus;
  hostToken: string;
  viewerTokens: string[];
  createdAt: number;
  lastActiveAt: number;
  activeViewersCount: number;
  currentStreamId?: string;
}

// Global in-memory room store (preserves across hot reloads in dev)
declare global {
  // eslint-disable-next-line no-var
  var __kshareRooms: Map<string, StoredRoom> | undefined;
}

const rooms = globalThis.__kshareRooms ?? new Map<string, StoredRoom>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__kshareRooms = rooms;
}

export const RoomStore = {
  create(params: { code: string; name: string; ownerId?: string }): StoredRoom {
    const normalizedCode = params.code.toUpperCase().replace(/\s+/g, "");
    const hostToken = "hst_" + Math.random().toString(36).substring(2, 12);
    const room: StoredRoom = {
      id: "room_" + Math.random().toString(36).substring(2, 10),
      code: normalizedCode,
      name: params.name,
      ownerId: params.ownerId,
      status: RoomStatus.IDLE,
      hostToken,
      viewerTokens: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      activeViewersCount: 0
    };
    rooms.set(normalizedCode, room);
    return room;
  },

  findByCode(code: string): StoredRoom | undefined {
    const normalizedCode = code.toUpperCase().replace(/\s+/g, "");
    return rooms.get(normalizedCode);
  },

  getAll(): StoredRoom[] {
    return Array.from(rooms.values()).sort((a, b) => b.createdAt - a.createdAt);
  },

  updateStatus(code: string, status: RoomStatus, streamId?: string): StoredRoom | undefined {
    const room = this.findByCode(code);
    if (!room) return undefined;
    room.status = status;
    room.lastActiveAt = Date.now();
    if (streamId !== undefined) {
      room.currentStreamId = streamId;
    }
    return room;
  },

  registerViewer(code: string, viewerToken: string): boolean {
    const room = this.findByCode(code);
    if (!room) return false;
    if (!room.viewerTokens.includes(viewerToken)) {
      room.viewerTokens.push(viewerToken);
    }
    room.activeViewersCount = room.viewerTokens.length;
    room.lastActiveAt = Date.now();
    return true;
  },

  removeViewer(code: string, viewerToken: string): void {
    const room = this.findByCode(code);
    if (!room) return;
    room.viewerTokens = room.viewerTokens.filter((t) => t !== viewerToken);
    room.activeViewersCount = room.viewerTokens.length;
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
