"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HostStudio } from "@/components/host-studio";

function HostContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawCode = (params?.code as string) || "";
  const code = rawCode.toUpperCase().replace(/\s+/g, "");

  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState("ห้องแชร์หน้าจอของฉัน");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlToken = searchParams?.get("token");
    const localToken =
      typeof window !== "undefined"
        ? localStorage.getItem(`kshare_host_${code}`)
        : null;
    const effectiveToken = urlToken || localToken || "";
    setToken(effectiveToken);

    fetch(`/api/rooms/${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room?.name) setRoomName(data.room.name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>กำลังเปิดสตูดิโอผู้ควบคุม {code}...</span>
        </div>
      </div>
    );
  }

  return (
    <HostStudio
      roomCode={code}
      initialRoomName={roomName}
      hostToken={token}
    />
  );
}

export default function HostPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span>กำลังเปิดสตูดิโอ...</span>
          </div>
        </div>
      }
    >
      <HostContent />
    </Suspense>
  );
}
