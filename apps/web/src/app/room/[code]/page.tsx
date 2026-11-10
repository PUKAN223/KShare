"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HostStudio } from "@/components/host-studio";
import { ViewerPlayer } from "@/components/viewer-player";
import { UserRole } from "@kshare/protocol";

function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawCode = (params?.code as string) || "";
  const code = rawCode.toUpperCase().replace(/\s+/g, "");

  const [role, setRole] = useState<UserRole | null>(null);
  const [roomName, setRoomName] = useState<string>("ห้องแชร์หน้าจอ");
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlToken = searchParams?.get("token");
    const localToken =
      typeof window !== "undefined"
        ? localStorage.getItem(`kshare_host_${code}`)
        : null;

    const effectiveToken = urlToken || localToken || "";
    setToken(effectiveToken);

    const checkAccess = async () => {
      try {
        const res = await fetch(`/api/rooms/${code}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: effectiveToken })
        });

        if (res.ok) {
          const data = await res.json();
          setRole(data.role || UserRole.VIEWER);
          if (data.room?.name) setRoomName(data.room.name);
        } else {
          setRole(UserRole.VIEWER);
        }
      } catch {
        setRole(UserRole.VIEWER);
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      checkAccess();
    }
  }, [code, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>กำลังเตรียมห้อง {code}...</span>
        </div>
      </div>
    );
  }

  if (role === UserRole.HOST) {
    return (
      <HostStudio
        roomCode={code}
        initialRoomName={roomName}
        hostToken={token}
      />
    );
  }

  return <ViewerPlayer roomCode={code} initialRoomName={roomName} />;
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span>กำลังโหลดห้อง...</span>
          </div>
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
