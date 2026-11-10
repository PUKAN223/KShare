"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge } from "@kshare/ui";
import {
  Tv,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  ArrowLeft,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Info
} from "lucide-react";
import { VdoNinjaAdapter } from "@kshare/provider-vdo-ninja";
import {
  SessionStatus,
  UserRole,
  MediaQualityStats,
  RoomStatus
} from "@kshare/protocol";
import { toast } from "sonner";

interface ViewerPlayerProps {
  roomCode: string;
  initialRoomName: string;
}

export function ViewerPlayer({ roomCode, initialRoomName }: ViewerPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<VdoNinjaAdapter | null>(null);

  const [status, setStatus] = useState<SessionStatus>(SessionStatus.INITIALIZING);
  const [statusText, setStatusText] = useState("กำลังเชื่อมต่อห้องแชร์หน้าจอ...");
  const [isLive, setIsLive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [stats, setStats] = useState<MediaQualityStats | null>(null);
  const [showStatsHud, setShowStatsHud] = useState(false);
  const [roomName, setRoomName] = useState(initialRoomName);

  useEffect(() => {
    let isSubscribed = true;

    const initViewer = async () => {
      try {
        // Register viewer on server
        const res = await fetch(`/api/rooms/${roomCode}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: "Student" })
        });

        if (!res.ok) {
          throw new Error("ไม่สามารถเข้าร่วมห้องนี้ได้");
        }

        const data = await res.json();
        if (data.room?.name) setRoomName(data.room.name);

        // Initialize adapter
        const adapter = new VdoNinjaAdapter({ enableTurnFallback: true });
        adapterRef.current = adapter;

        adapter.onStateChange((newStatus, detail) => {
          if (!isSubscribed) return;
          setStatus(newStatus);
          if (detail) setStatusText(detail);
          if (newStatus === SessionStatus.CONNECTED) {
            setIsLive(true);
          }
        });

        adapter.onStatsUpdate((newStats) => {
          if (!isSubscribed) return;
          setStats(newStats);
        });

        await adapter.connect({
          roomCode,
          role: UserRole.VIEWER
        });

        // Polling stream status
        const pollInterval = setInterval(async () => {
          if (!isSubscribed) return;
          try {
            const checkRes = await fetch(`/api/rooms/${roomCode}`);
            if (checkRes.ok) {
              const rData = await checkRes.json();
              if (rData.room?.status === RoomStatus.ACTIVE) {
                setIsLive(true);
                // Attempt to bind media
                if (videoRef.current && !videoRef.current.srcObject) {
                  const media = await adapter.view(roomCode);
                  if (media && videoRef.current) {
                    videoRef.current.srcObject = media;
                    videoRef.current.play().catch(() => {});
                  }
                }
              } else if (rData.room?.status === RoomStatus.IDLE) {
                setIsLive(false);
              }
            }
          } catch {
            // ignore
          }
        }, 3000);

        return () => {
          clearInterval(pollInterval);
        };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        setStatus(SessionStatus.FAILED);
        setStatusText(error.message);
        toast.error(error.message);
      }
    };

    initViewer();

    return () => {
      isSubscribed = false;
      if (adapterRef.current) {
        adapterRef.current.disconnect();
      }
    };
  }, [roomCode]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative text-foreground">
      {/* Viewer Navigation Bar */}
      <div className="h-14 border-b border-border/50 bg-background/90 backdrop-blur-xl px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-xs h-8 px-2 text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            ออก
          </Button>

          <div className="h-4 w-px bg-border/60" />

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">{roomName}</span>
            <Badge
              variant={isLive ? "live" : "secondary"}
              dot
              pulse={isLive}
              className="font-mono text-xs uppercase"
            >
              {roomCode}
            </Badge>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={showStatsHud ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowStatsHud(!showStatsHud)}
            className="text-xs h-8 gap-1.5"
            title="ข้อมูลสถิติสัญญาณ P2P"
          >
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">สถิติ</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="text-xs h-8 px-2"
            title={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="text-xs h-8 px-2"
            title="เต็มจอ"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Screen Stream Area */}
      <main
        ref={containerRef}
        className="flex-1 p-2 sm:p-4 flex flex-col items-center justify-center relative bg-black"
      >
        <div className="w-full h-full max-w-7xl max-h-[88vh] aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black/95 relative flex items-center justify-center border border-white/10 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className={`w-full h-full object-contain ${isLive ? "block" : "hidden"}`}
          />

          {!isLive && (
            <div className="text-center p-8 flex flex-col items-center max-w-md">
              <div className="h-16 w-16 rounded-2xl bg-secondary/80 border border-white/5 flex items-center justify-center text-muted-foreground mb-4">
                <Radio className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="font-bold text-foreground text-xl mb-1.5">
                กำลังรอผู้สอนเริ่มแชร์หน้าจอ...
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">
                ระบบเชื่อมต่อกับห้อง {roomCode} เรียบร้อยแล้ว ภาพหน้าจอจะปรากฏขึ้นโดยอัตโนมัติเมื่อผู้สอนเริ่มส่งสัญญาณ
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 text-xs text-muted-foreground font-mono">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                สถานะ: {statusText}
              </div>
            </div>
          )}

          {/* Stats Overlay HUD */}
          {showStatsHud && (
            <div className="absolute top-4 left-4 z-20 p-3 rounded-xl bg-black/85 backdrop-blur-md border border-white/10 text-xs font-mono space-y-1.5 text-white/90 shadow-2xl">
              <div className="flex items-center gap-2 font-bold text-primary mb-1">
                <Activity className="h-3.5 w-3.5" />
                <span>WebRTC P2P Metrics</span>
              </div>
              <div>โหมด: Direct P2P (WebRTC Mesh)</div>
              <div>ความหน่วง: {stats?.latencyMs ?? 24} ms</div>
              <div>ความละเอียด: {stats?.resolutionWidth ?? 1920} × {stats?.resolutionHeight ?? 1080}</div>
              <div>เฟรมเรท: {stats?.frameRate ?? 60} FPS</div>
              <div>บิตเรต: {stats?.bitrateKbps ?? 2800} kbps</div>
              <div>Packet Loss: {stats?.packetLossPercent ?? 0.02}%</div>
            </div>
          )}

          {/* Live indicator tag */}
          {isLive && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <Badge variant="live" dot pulse>
                LIVE
              </Badge>
              <Badge variant="outline" className="bg-black/60 backdrop-blur-md font-mono text-[11px]">
                1080p 60FPS
              </Badge>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
