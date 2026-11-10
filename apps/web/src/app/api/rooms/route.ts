import { NextRequest, NextResponse } from "next/server";
import { generateRoomCode, RoomStatus } from "@kshare/protocol";
import { RoomStore, RoomHostSettings, normalizeRoomCode } from "@/lib/room-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const subject =
      typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : "ทั่วไป";
    const customCode =
      typeof body.customCode === "string"
        ? normalizeRoomCode(body.customCode)
        : "";
    const initialSettings = (body.settings || {}) as Partial<RoomHostSettings>;

    const roomCode =
      customCode && customCode.replace(/[^A-Z0-9]/g, "").length >= 4
        ? customCode
        : generateRoomCode();

    const existing = await RoomStore.findByCode(roomCode);
    if (existing) {
      return NextResponse.json(
        { error: `รหัสห้อง ${roomCode} มีการใช้งานอยู่แล้ว กรุณาใช้รหัสอื่น` },
        { status: 409 }
      );
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : `ห้อง ${roomCode}`;

    const room = await RoomStore.create({
      code: roomCode,
      name,
      subject,
      initialSettings
    });

    const origin = req.nextUrl.origin;
    const inviteUrl = `${origin}/room/${room.code}`;

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        subject: room.subject,
        status: room.status,
        settings: room.settings,
        createdAt: room.createdAt,
        inviteUrl
      },
      hostToken: room.hostToken
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างห้อง" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const allRooms = (await RoomStore.getAll())
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        subject: r.subject,
        status: r.status,
        isLocked: r.settings.isLocked,
        hasPin: Boolean(r.settings.pinCode),
        resolution: r.settings.resolution,
        frameRate: r.settings.frameRate,
        activeViewersCount: r.activeViewersCount,
        thumbnailDataUrl:
          (r.status === RoomStatus.LIVE || r.status === RoomStatus.ACTIVE) &&
          !r.settings.isPaused
            ? r.thumbnailDataUrl
            : undefined,
        createdAt: r.createdAt
      }));

    return NextResponse.json({ rooms: allRooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "ไม่สามารถดึงข้อมูลห้องได้" },
      { status: 500 }
    );
  }
}
