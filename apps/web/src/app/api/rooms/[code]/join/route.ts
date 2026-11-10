import { NextRequest, NextResponse } from "next/server";
import { RoomStore } from "@/lib/room-store";
import { UserRole } from "@kshare/protocol";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { token, displayName } = body;

    const access = RoomStore.verifyAccess(code, token);
    if (!access.valid || !access.room) {
      return NextResponse.json({ error: "ไม่พบห้องหรือรหัสห้องไม่ถูกต้อง" }, { status: 404 });
    }

    if (access.role === UserRole.HOST) {
      return NextResponse.json({
        success: true,
        role: UserRole.HOST,
        room: access.room
      });
    }

    // Viewer joining
    const viewerToken = "view_" + Math.random().toString(36).substring(2, 12);
    RoomStore.registerViewer(code, viewerToken);

    return NextResponse.json({
      success: true,
      role: UserRole.VIEWER,
      viewerToken,
      displayName: displayName || "Viewer",
      room: {
        id: access.room.id,
        code: access.room.code,
        name: access.room.name,
        status: access.room.status,
        currentStreamId: access.room.currentStreamId
      }
    });
  } catch (error) {
    console.error("Error joining room:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเข้าร่วมห้อง" }, { status: 500 });
  }
}
