import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { RoomStatus, formatRoomCode } from "@kshare/protocol";
import { RoomHostSettings } from "@/lib/room-types";

export interface RoomListItem {
  id: string;
  code: string;
  name: string;
  subject?: string;
  status: RoomStatus;
  isLocked: boolean;
  hasPin: boolean;
  resolution: string;
  frameRate: number;
  activeViewersCount: number;
  thumbnailDataUrl?: string;
  createdAt: number;
}

export interface CachedRoomDetail {
  id?: string;
  code: string;
  name: string;
  subject?: string;
  status: RoomStatus;
  settings?: RoomHostSettings;
  activeViewersCount?: number;
  thumbnailDataUrl?: string;
  createdAt?: number;
}

export interface RoomState {
  rooms: RoomListItem[];
  roomsByCode: Record<string, CachedRoomDetail>;
  loading: boolean;
  isInitialized: boolean;
  lastFetchedAt: number | null;
  error: string | null;
}

const STORAGE_KEY = "kshare_cached_rooms";

export function loadRoomsFromStorage(): RoomListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore storage parse errors
  }
  return [];
}

export function saveRoomsToStorage(rooms: RoomListItem[]): void {
  if (typeof window === "undefined") return;
  try {
    // Save up to 30 recent rooms to localStorage
    const toSave = rooms.slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage quota errors
  }
}

export const fetchRoomsThunk = createAsyncThunk(
  "room/fetchRooms",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch("/api/rooms");
      if (!res.ok) {
        return rejectWithValue("Failed to fetch rooms");
      }
      const data = await res.json();
      return (data.rooms || []) as RoomListItem[];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return rejectWithValue(msg);
    }
  }
);

const initialState: RoomState = {
  rooms: [],
  roomsByCode: {},
  loading: false,
  isInitialized: false,
  lastFetchedAt: null,
  error: null
};

export const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    hydrateCache: (state, action: PayloadAction<RoomListItem[]>) => {
      // Hydrate from localStorage without clearing if fresh data already exists
      if (action.payload && action.payload.length > 0 && state.rooms.length === 0) {
        state.rooms = action.payload;
        for (const r of action.payload) {
          const normCode = r.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
          state.roomsByCode[normCode] = {
            id: r.id,
            code: r.code,
            name: r.name,
            subject: r.subject,
            status: r.status,
            activeViewersCount: r.activeViewersCount,
            thumbnailDataUrl: r.thumbnailDataUrl,
            createdAt: r.createdAt
          };
          state.roomsByCode[r.code] = state.roomsByCode[normCode];
        }
      }
      state.isInitialized = true;
    },
    setRooms: (state, action: PayloadAction<RoomListItem[]>) => {
      state.rooms = action.payload;
      state.loading = false;
      state.isInitialized = true;
      state.lastFetchedAt = Date.now();
      state.error = null;

      for (const r of action.payload) {
        const normCode = r.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const existingDetail = state.roomsByCode[normCode] || state.roomsByCode[r.code];
        state.roomsByCode[normCode] = {
          ...existingDetail,
          id: r.id,
          code: r.code,
          name: r.name,
          subject: r.subject,
          status: r.status,
          activeViewersCount: r.activeViewersCount,
          thumbnailDataUrl: r.thumbnailDataUrl ?? existingDetail?.thumbnailDataUrl,
          createdAt: r.createdAt
        };
        state.roomsByCode[r.code] = state.roomsByCode[normCode];
      }

      saveRoomsToStorage(action.payload);
    },
    upsertRoom: (
      state,
      action: PayloadAction<
        Partial<RoomListItem> & { code: string; name?: string; settings?: RoomHostSettings }
      >
    ) => {
      const room = action.payload;
      const formattedCode = formatRoomCode(room.code);
      const normCode = room.code.toUpperCase().replace(/[^A-Z0-9]/g, "");

      // Update room list
      const idx = state.rooms.findIndex(
        (r) =>
          r.code.toUpperCase().replace(/[^A-Z0-9]/g, "") === normCode ||
          r.code === formattedCode ||
          r.code === room.code
      );

      const existingListItem = idx >= 0 ? state.rooms[idx] : undefined;

      const updatedListItem: RoomListItem = {
        id: room.id || existingListItem?.id || `room_${normCode}`,
        code: formattedCode,
        name: room.name || existingListItem?.name || `ห้อง ${formattedCode}`,
        subject: room.subject || existingListItem?.subject || "ทั่วไป",
        status: room.status || existingListItem?.status || RoomStatus.IDLE,
        isLocked: room.isLocked ?? existingListItem?.isLocked ?? false,
        hasPin: room.hasPin ?? existingListItem?.hasPin ?? Boolean(room.settings?.pinCode),
        resolution: room.resolution || existingListItem?.resolution || room.settings?.resolution || "1080p",
        frameRate: room.frameRate || existingListItem?.frameRate || room.settings?.frameRate || 60,
        activeViewersCount: room.activeViewersCount ?? existingListItem?.activeViewersCount ?? 0,
        thumbnailDataUrl: room.thumbnailDataUrl ?? existingListItem?.thumbnailDataUrl,
        createdAt: room.createdAt || existingListItem?.createdAt || Date.now()
      };

      if (idx >= 0) {
        state.rooms[idx] = updatedListItem;
      } else {
        state.rooms.unshift(updatedListItem);
      }

      // Update detail cache
      const existingDetail = state.roomsByCode[normCode] || state.roomsByCode[room.code];
      const detail: CachedRoomDetail = {
        ...existingDetail,
        id: updatedListItem.id,
        code: formattedCode,
        name: updatedListItem.name,
        subject: updatedListItem.subject,
        status: updatedListItem.status,
        settings: room.settings || existingDetail?.settings,
        activeViewersCount: updatedListItem.activeViewersCount,
        thumbnailDataUrl: updatedListItem.thumbnailDataUrl,
        createdAt: updatedListItem.createdAt
      };

      state.roomsByCode[normCode] = detail;
      state.roomsByCode[formattedCode] = detail;
      state.roomsByCode[room.code] = detail;

      saveRoomsToStorage(state.rooms);
    },
    removeRoom: (state, action: PayloadAction<string>) => {
      const code = action.payload;
      const normCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const formattedCode = formatRoomCode(code);

      state.rooms = state.rooms.filter(
        (r) =>
          r.code.toUpperCase().replace(/[^A-Z0-9]/g, "") !== normCode &&
          r.code !== formattedCode &&
          r.code !== code
      );
      delete state.roomsByCode[normCode];
      delete state.roomsByCode[formattedCode];
      delete state.roomsByCode[code];

      saveRoomsToStorage(state.rooms);
    },
    setRoomDetail: (state, action: PayloadAction<CachedRoomDetail>) => {
      const detail = action.payload;
      const normCode = detail.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const formattedCode = formatRoomCode(detail.code);

      const merged: CachedRoomDetail = {
        ...(state.roomsByCode[normCode] || {}),
        ...detail,
        code: formattedCode
      };

      state.roomsByCode[normCode] = merged;
      state.roomsByCode[formattedCode] = merged;
      state.roomsByCode[detail.code] = merged;

      // Also update in list if present
      const idx = state.rooms.findIndex(
        (r) => r.code.toUpperCase().replace(/[^A-Z0-9]/g, "") === normCode
      );
      if (idx >= 0) {
        state.rooms[idx] = {
          ...state.rooms[idx],
          name: detail.name || state.rooms[idx].name,
          subject: detail.subject || state.rooms[idx].subject,
          status: detail.status || state.rooms[idx].status,
          activeViewersCount: detail.activeViewersCount ?? state.rooms[idx].activeViewersCount,
          thumbnailDataUrl: detail.thumbnailDataUrl ?? state.rooms[idx].thumbnailDataUrl
        };
        saveRoomsToStorage(state.rooms);
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoomsThunk.pending, (state) => {
        // Do NOT clear state.rooms here!
        // This ensures existing cached rooms remain visible while fresh data is being fetched.
        state.loading = true;
      })
      .addCase(fetchRoomsThunk.fulfilled, (state, action) => {
        state.rooms = action.payload;
        state.loading = false;
        state.isInitialized = true;
        state.lastFetchedAt = Date.now();
        state.error = null;

        for (const r of action.payload) {
          const normCode = r.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
          const existingDetail = state.roomsByCode[normCode] || state.roomsByCode[r.code];
          state.roomsByCode[normCode] = {
            ...existingDetail,
            id: r.id,
            code: r.code,
            name: r.name,
            subject: r.subject,
            status: r.status,
            activeViewersCount: r.activeViewersCount,
            thumbnailDataUrl: r.thumbnailDataUrl ?? existingDetail?.thumbnailDataUrl,
            createdAt: r.createdAt
          };
          state.roomsByCode[r.code] = state.roomsByCode[normCode];
        }

        saveRoomsToStorage(action.payload);
      })
      .addCase(fetchRoomsThunk.rejected, (state, action) => {
        // Do NOT clear state.rooms on error - keep displaying the cached rooms
        state.loading = false;
        state.error = (action.payload as string) || "Failed to fetch rooms";
      });
  }
});

export const {
  hydrateCache,
  setRooms,
  upsertRoom,
  removeRoom,
  setRoomDetail,
  setLoading
} = roomSlice.actions;

export const selectRooms = (state: { room: RoomState }) => state.room.rooms;
export const selectRoomsLoading = (state: { room: RoomState }) => state.room.loading;
export const selectRoomsInitialized = (state: { room: RoomState }) => state.room.isInitialized;
export const selectRoomByCode = (state: { room: RoomState }, code: string) => {
  if (!code) return undefined;
  const normCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return state.room.roomsByCode[normCode] || state.room.roomsByCode[code] || undefined;
};

export default roomSlice.reducer;
