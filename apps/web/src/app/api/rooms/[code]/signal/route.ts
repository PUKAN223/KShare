import { NextRequest, NextResponse } from "next/server";

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
if (process.env.NODE_ENV !== "production") {
  globalThis.__kshareRoomSignals = roomSignals;
}

function getRoomSignalState(code: string): RoomSignalState {
  const normalized = code.toUpperCase().replace(/\s+/g, "");
  let state = roomSignals.get(normalized);
  if (!state) {
    state = {
      hostActive: false,
      slots: {},
      updatedAt: Date.now()
    };
    roomSignals.set(normalized, state);
  }
  // Clean up stale slots older than 2 minutes
  const now = Date.now();
  for (const [vid, slot] of Object.entries(state.slots)) {
    if (now - slot.updatedAt > 120000) {
      delete state.slots[vid];
    }
  }
  return state;
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
  const state = getRoomSignalState(code);
  const role = req.nextUrl.searchParams.get("role");
  const viewerId = req.nextUrl.searchParams.get("viewerId") || "default";

  if (role === "host") {
    return NextResponse.json({
      hostActive: state.hostActive,
      slots: state.slots,
      updatedAt: state.updatedAt
    });
  }

  const slot = getOrCreateSlot(state, viewerId);
  slot.updatedAt = Date.now();

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
    const state = getRoomSignalState(code);

    const { role, viewerId = "default", type, sdp, candidate, reset, sessionEpoch } = body;

    if (reset) {
      state.hostActive = false;
      state.slots = {};
      state.updatedAt = Date.now();
      return NextResponse.json({ success: true, reset: true });
    }

    if (role === "host") {
      state.hostActive = true;

      if (type === "broadcast-start") {
        // Mark all waiting viewers as needing a fresh offer for the new stream
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
        return NextResponse.json({ success: true });
      }

      const slot = getOrCreateSlot(state, viewerId);
      if (type === "offer" && sdp) {
        slot.offer = sdp;
        slot.answer = null;
        slot.needsOffer = false;
        slot.hostCandidates = [];
        slot.viewerCandidates = [];
        slot.updatedAt = Date.now();
      }
      if (candidate) {
        slot.hostCandidates.push(candidate);
        slot.updatedAt = Date.now();
      }
      state.updatedAt = Date.now();
    } else if (role === "viewer") {
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
        return NextResponse.json({
          success: true,
          sessionEpoch: slot.sessionEpoch
        });
      }

      if (type === "answer" && sdp) {
        if (!sessionEpoch || sessionEpoch === slot.sessionEpoch) {
          slot.answer = sdp;
          slot.needsOffer = false;
          slot.updatedAt = Date.now();
        }
      }
      if (candidate) {
        slot.viewerCandidates.push(candidate);
        slot.updatedAt = Date.now();
      }
      state.updatedAt = Date.now();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signal API error:", error);
    return NextResponse.json({ error: "Failed to process signal" }, { status: 500 });
  }
}
