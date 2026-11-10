import { NextRequest, NextResponse } from "next/server";
import { CreateRoomSchema } from "@kshare/validators";
import { generateRoomCode } from "@kshare/protocol";
import { RoomStore } from "@/lib/room-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, customCode } = parsed.data;
    const roomCode = customCode && customCode.trim() !== "" ? customCode.trim() : generateRoomCode();

    // Check if room code already exists
    if (RoomStore.findByCode(roomCode)) {
      return NextResponse.json(
        { error: `รหัสห้อง ${roomCode} มีการใช้งานอยู่แล้ว กรุณาลองรหัสอื่น` },
        { status: 409 }
      );
    }

    const room = RoomStore.create({
      code: roomCode,
      name
    });

    const origin = req.nextUrl.origin;
    const inviteUrl = `${origin}/room/${room.code}`;

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        status: room.status,
        createdAt: room.createdAt,
        inviteUrl
      },
      hostToken: room.hostToken
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างห้อง" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const allRooms = RoomStore.getAll().slice(0, 20).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      status: r.status,
      activeViewersCount: r.activeViewersCount,
      createdAt: r.createdAt
    }));

    return NextResponse.json({ rooms: allRooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลห้องได้" }, { status: 500 });
  }
}
