import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kshare/database";
import { getCandidateCodes, normalizeRoomCode } from "@/lib/room-store";

export interface PeerSignalSlot {
  viewerId: string;
  sessionEpoch: number;
  needsOffer: boolean;
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  hostCandidates: RTCIceCandidateInit[];
  viewerCandidates: RTCIceCandidateInit[];
  updatedAt: number;
}

interface RoomSignalState {
  hostActive: boolean;
  slots: Record<string, PeerSignalSlot>;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __kshareRoomSignals: Map<string, RoomSignalState> | undefined;
}

const roomSignals = globalThis.__kshareRoomSignals ?? new Map<string, RoomSignalState>();
globalThis.__kshareRoomSignals = roomSignals;

async function getRoomSignalState(code: string): Promise<{
  canonicalCode: string;
  state: RoomSignalState;
}> {
  const candidates = getCandidateCodes(code);
  const canonicalCode = normalizeRoomCode(code);

  let state = roomSignals.get(canonicalCode);

  try {
    const row = await prisma.room.findFirst({
      where: { code: { in: candidates } },
      select: { code: true, signalsJson: true }
    });
    if (row) {
      if (row.signalsJson && row.signalsJson !== "{}") {
        const dbState = JSON.parse(row.signalsJson) as RoomSignalState;
        if (dbState) {
          state = dbState;
          roomSignals.set(row.code, state);
        }
      }
      if (!state) {
        state = {
          hostActive: false,
          slots: {},
          updatedAt: Date.now()
        };
        roomSignals.set(row.code, state);
      }
      return { canonicalCode: row.code, state: pruneStaleSlots(state) };
    }
  } catch {
    // Fallback to memory state
  }

  if (!state) {
    state = {
      hostActive: false,
      slots: {},
      updatedAt: Date.now()
    };
    roomSignals.set(canonicalCode, state);
  }

  return { canonicalCode, state: pruneStaleSlots(state) };
}

function pruneStaleSlots(state: RoomSignalState): RoomSignalState {
  const now = Date.now();
  if (!state.slots) state.slots = {};
  for (const [vid, slot] of Object.entries(state.slots)) {
    if (now - slot.updatedAt > 120000) {
      delete state.slots[vid];
    }
  }
  return state;
}

async function saveRoomSignalState(
  canonicalCode: string,
  state: RoomSignalState
): Promise<void> {
  roomSignals.set(canonicalCode, state);
  try {
    await prisma.room.update({
      where: { code: canonicalCode },
      data: {
        signalsJson: JSON.stringify(state),
        lastActiveAt: new Date()
      }
    });
  } catch {
    // Ignore DB signal sync error
  }
}

function getOrCreateSlot(state: RoomSignalState, viewerId: string): PeerSignalSlot {
  let slot = state.slots[viewerId];
  if (!slot) {
    slot = {
      viewerId,
      sessionEpoch: 1,
      needsOffer: true,
      offer: null,
      answer: null,
      hostCandidates: [],
      viewerCandidates: [],
      updatedAt: Date.now()
    };
    state.slots[viewerId] = slot;
  }
  return slot;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const { canonicalCode, state } = await getRoomSignalState(code);
  const role = req.nextUrl.searchParams.get("role");
  const viewerId = req.nextUrl.searchParams.get("viewerId") || "default";

  if (role === "host") {
    return NextResponse.json({
      hostActive: state.hostActive,
      slots: state.slots,
      updatedAt: state.updatedAt
    });
  }

  const isNewSlot = !state.slots[viewerId];
  const slot = getOrCreateSlot(state, viewerId);
  slot.updatedAt = Date.now();

  if (isNewSlot) {
    state.updatedAt = Date.now();
    await saveRoomSignalState(canonicalCode, state);
  }

  return NextResponse.json({
    hostActive: state.hostActive,
    viewerId: slot.viewerId,
    sessionEpoch: slot.sessionEpoch,
    needsOffer: slot.needsOffer,
    offer: slot.offer,
    answer: slot.answer,
    hostCandidates: slot.hostCandidates,
    viewerCandidates: slot.viewerCandidates,
    updatedAt: slot.updatedAt
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const { canonicalCode, state } = await getRoomSignalState(code);

    const {
      role,
      viewerId = "default",
      type,
      sdp,
      candidate,
      candidates,
      reset,
      sessionEpoch
    } = body;

    if (reset) {
      state.hostActive = false;
      state.slots = {};
      state.updatedAt = Date.now();
      await saveRoomSignalState(canonicalCode, state);
      return NextResponse.json({ success: true, reset: true });
    }

    if (role === "host") {
      state.hostActive = true;

      if (type === "broadcast-start") {
        for (const slot of Object.values(state.slots)) {
          slot.sessionEpoch += 1;
          slot.needsOffer = true;
          slot.offer = null;
          slot.answer = null;
          slot.hostCandidates = [];
          slot.viewerCandidates = [];
          slot.updatedAt = Date.now();
        }
        state.updatedAt = Date.now();
        await saveRoomSignalState(canonicalCode, state);
        return NextResponse.json({ success: true });
      }

      const slot = getOrCreateSlot(state, viewerId);
      if (type === "offer" && sdp) {
        if (typeof sessionEpoch === "number" && sessionEpoch > slot.sessionEpoch) {
          slot.sessionEpoch = sessionEpoch;
        }
        slot.offer = sdp;
        slot.answer = null;
        slot.needsOffer = false;
        slot.hostCandidates = Array.isArray(candidates) ? [...candidates] : [];
        slot.viewerCandidates = [];
        slot.updatedAt = Date.now();
      } else {
        if (candidate) {
          slot.hostCandidates.push(candidate);
          slot.updatedAt = Date.now();
        }
        if (Array.isArray(candidates) && candidates.length > 0) {
          slot.hostCandidates.push(...candidates);
          slot.updatedAt = Date.now();
        }
      }
      state.updatedAt = Date.now();
      await saveRoomSignalState(canonicalCode, state);
    } else if (role === "viewer") {
      state.hostActive = true;
      const slot = getOrCreateSlot(state, viewerId);

      if (type === "request-offer") {
        slot.sessionEpoch += 1;
        slot.needsOffer = true;
        slot.offer = null;
        slot.answer = null;
        slot.hostCandidates = [];
        slot.viewerCandidates = [];
        slot.updatedAt = Date.now();
        state.updatedAt = Date.now();
        await saveRoomSignalState(canonicalCode, state);
        return NextResponse.json({
          success: true,
          sessionEpoch: slot.sessionEpoch
        });
      }

      if (sessionEpoch && sessionEpoch < slot.sessionEpoch) {
        return NextResponse.json({
          success: false,
          ignored: true,
          reason: "stale-epoch"
        });
      }

      if (type === "answer" && sdp) {
        slot.answer = sdp;
        slot.needsOffer = false;
        if (Array.isArray(candidates) && candidates.length > 0) {
          slot.viewerCandidates.push(...candidates);
        }
        slot.updatedAt = Date.now();
      } else {
        if (candidate) {
          slot.viewerCandidates.push(candidate);
          slot.updatedAt = Date.now();
        }
        if (Array.isArray(candidates) && candidates.length > 0) {
          slot.viewerCandidates.push(...candidates);
          slot.updatedAt = Date.now();
        }
      }
      state.updatedAt = Date.now();
      await saveRoomSignalState(canonicalCode, state);
    }

    return NextResponse.json({ success: true, updatedAt: state.updatedAt });
  } catch (error) {
    console.error("Signaling error:", error);
    return NextResponse.json({ error: "Signaling failed" }, { status: 400 });
  }
}
