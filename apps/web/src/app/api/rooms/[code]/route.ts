import { NextRequest, NextResponse } from "next/server";
import { RoomStore } from "@/lib/room-store";
import { RoomStatus } from "@kshare/protocol";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const room = RoomStore.findByCode(code);

    if (!room) {
      return NextResponse.json({ error: "ไม่พบห้องนี้ในระบบ" }, { status: 404 });
    }

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        status: room.status,
        activeViewersCount: room.activeViewersCount,
        currentStreamId: room.currentStreamId,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error("Error fetching room details:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลห้อง" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const { hostToken, status, streamId } = body;

    const access = RoomStore.verifyAccess(code, hostToken);
    if (!access.valid || access.role !== "HOST") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ปรับแต่งสถานะของห้องนี้" }, { status: 403 });
    }

    const updated = RoomStore.updateStatus(
      code,
      status as RoomStatus,
      streamId
    );

    return NextResponse.json({ success: true, room: updated });
  } catch (error) {
    console.error("Error updating room status:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" }, { status: 500 });
  }
}
