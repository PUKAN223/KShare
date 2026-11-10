import { NextRequest, NextResponse } from "next/server";
import { RoomStore, RoomHostSettings } from "@/lib/room-store";
import { RoomStatus, UserRole } from "@kshare/protocol";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    let room = await RoomStore.findByCode(code);

    if (!room) {
      return NextResponse.json({ error: "ไม่พบห้องนี้ในระบบ" }, { status: 404 });
    }

    const viewerId = req.nextUrl.searchParams.get("viewerId");
    if (viewerId && room.participants[viewerId] && !room.participants[viewerId].kicked) {
      const upserted = await RoomStore.upsertParticipant(room.code, {
        viewerId,
        displayName: room.participants[viewerId].displayName,
        deviceHint: room.participants[viewerId].deviceHint
      });
      if (upserted.room) {
        room = upserted.room;
      }
    }

    const activeParticipants = Object.values(room.participants).filter(
      (p) => !p.kicked && Date.now() - p.lastSeenAt < 35000
    );

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        subject: room.subject,
        status: room.status,
        activeViewersCount: activeParticipants.length,
        participants: activeParticipants,
        settings: {
          ...room.settings,
          pinCode: undefined,
          hasPin: Boolean(room.settings.pinCode)
        },
        currentStreamId: room.currentStreamId,
        createdAt: room.createdAt
      },
      kicked: viewerId ? Boolean(room.participants[viewerId]?.kicked) : false
    });
  } catch (error) {
    console.error("Error fetching room details:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลห้อง" },
      { status: 500 }
    );
  }
}

// POST: Verify access / Join room (Host or Viewer)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { token, viewerId, displayName, deviceHint, pinCode } = body;

    const access = await RoomStore.verifyAccess(code, token);
    if (!access.valid || !access.room) {
      return NextResponse.json(
        { error: "ไม่พบห้องนี้หรือรหัสห้องไม่ถูกต้อง" },
        { status: 404 }
      );
    }

    if (access.role === UserRole.HOST) {
      return NextResponse.json({
        success: true,
        role: UserRole.HOST,
        room: access.room
      });
    }

    // Check PIN if required
    if (
      access.room.settings.pinCode &&
      access.room.settings.pinCode !== (pinCode || "")
    ) {
      return NextResponse.json(
        {
          error: "รหัส PIN สำหรับเข้าห้องไม่ถูกต้อง",
          requiresPin: true,
          roomName: access.room.name
        },
        { status: 401 }
      );
    }

    const effectiveViewerId =
      viewerId || "v_" + Math.random().toString(36).substring(2, 10);

    const joinRes = await RoomStore.upsertParticipant(access.room.code, {
      viewerId: effectiveViewerId,
      displayName,
      deviceHint
    });

    if (!joinRes.allowed || !joinRes.room) {
      return NextResponse.json(
        { error: joinRes.reason || "ไม่สามารถเข้าห้องได้" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      role: UserRole.VIEWER,
      viewerId: effectiveViewerId,
      room: {
        id: joinRes.room.id,
        code: joinRes.room.code,
        name: joinRes.room.name,
        subject: joinRes.room.subject,
        status: joinRes.room.status,
        settings: {
          ...joinRes.room.settings,
          pinCode: undefined,
          hasPin: Boolean(joinRes.room.settings.pinCode)
        }
      }
    });
  } catch (error) {
    console.error("Error joining room:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเข้าร่วมห้อง" },
      { status: 500 }
    );
  }
}

// PATCH: Host updates room status, settings, or kicks a viewer
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const {
      hostToken,
      status,
      streamId,
      name,
      subject,
      thumbnailDataUrl,
      settings,
      kickViewerId
    } = body;

    const access = await RoomStore.verifyAccess(code, hostToken);
    if (!access.valid || access.role !== UserRole.HOST) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์ปรับแต่งสถานะของห้องนี้" },
        { status: 403 }
      );
    }

    if (kickViewerId) {
      await RoomStore.kickParticipant(code, kickViewerId);
    }

    const updated = await RoomStore.updateRoom(code, {
      status: status as RoomStatus | undefined,
      streamId,
      name,
      subject,
      thumbnailDataUrl,
      settings: settings as Partial<RoomHostSettings> | undefined
    });

    return NextResponse.json({ success: true, room: updated });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตห้อง" },
      { status: 500 }
    );
  }
}

// DELETE: Host closes/deletes room
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.nextUrl.searchParams.get("token") || undefined;
    const deleted = await RoomStore.deleteRoom(code, token);
    if (!deleted) {
      return NextResponse.json({ error: "ไม่สามารถลบห้องได้" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบห้อง" },
      { status: 500 }
    );
  }
}
