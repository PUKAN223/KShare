"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ViewerPlayer } from "@/components/viewer-player";

export default function ViewOnlyPage() {
  const params = useParams();
  const rawCode = (params?.code as string) || "";
  const code = rawCode.toUpperCase().replace(/\s+/g, "");

  const [roomName, setRoomName] = useState("ห้องรับชม");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/rooms/${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room?.name) setRoomName(data.room.name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>กำลังเชื่อมต่อห้องรับชม {code}...</span>
        </div>
      </div>
    );
  }

  return <ViewerPlayer roomCode={code} initialRoomName={roomName} />;
}
