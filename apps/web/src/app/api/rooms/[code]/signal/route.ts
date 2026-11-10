import { NextRequest, NextResponse } from "next/server";

interface RoomSignal {
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  hostCandidates: RTCIceCandidateInit[];
  viewerCandidates: RTCIceCandidateInit[];
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __kshareSignals: Map<string, RoomSignal> | undefined;
}

const signals = globalThis.__kshareSignals ?? new Map<string, RoomSignal>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__kshareSignals = signals;
}

function getSignal(code: string): RoomSignal {
  const normalized = code.toUpperCase().replace(/\s+/g, "");
  let sig = signals.get(normalized);
  if (!sig) {
    sig = {
      offer: null,
      answer: null,
      hostCandidates: [],
      viewerCandidates: [],
      updatedAt: Date.now()
    };
    signals.set(normalized, sig);
  }
  return sig;
}

// GET: Retrieve current signal for this room
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sig = getSignal(code);
  return NextResponse.json({
    offer: sig.offer,
    answer: sig.answer,
    hostCandidates: sig.hostCandidates,
    viewerCandidates: sig.viewerCandidates,
    updatedAt: sig.updatedAt
  });
}

// POST: Send offer, answer, or ice candidates
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const sig = getSignal(code);

    const { role, type, sdp, candidate, reset } = body;

    if (reset) {
      sig.offer = null;
      sig.answer = null;
      sig.hostCandidates = [];
      sig.viewerCandidates = [];
      sig.updatedAt = Date.now();
      return NextResponse.json({ success: true, reset: true });
    }

    if (role === "host") {
      if (type === "offer" && sdp) {
        sig.offer = sdp;
        sig.answer = null; // Clear previous answer
        sig.hostCandidates = [];
        sig.viewerCandidates = [];
        sig.updatedAt = Date.now();
      }
      if (candidate) {
        sig.hostCandidates.push(candidate);
        sig.updatedAt = Date.now();
      }
    } else if (role === "viewer") {
      if (type === "answer" && sdp) {
        sig.answer = sdp;
        sig.updatedAt = Date.now();
      }
      if (candidate) {
        sig.viewerCandidates.push(candidate);
        sig.updatedAt = Date.now();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signal API error:", error);
    return NextResponse.json({ error: "Failed to process signal" }, { status: 500 });
  }
}
