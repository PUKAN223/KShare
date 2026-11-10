"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge, Input } from "@kshare/ui";
import {
  MonitorPlay,
  StopCircle,
  Mic,
  MicOff,
  Copy,
  Check,
  Users,
  Radio,
  Settings,
  QrCode,
  Maximize2,
  Tv,
  ArrowLeft,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  Activity
} from "lucide-react";
import { ScreenCaptureManager, CaptureMetadata } from "@kshare/capture";
import { VdoNinjaAdapter } from "@kshare/provider-vdo-ninja";
import {
  SessionStatus,
  UserRole,
  MediaQualityStats,
  RoomStatus
} from "@kshare/protocol";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface HostStudioProps {
  roomCode: string;
  initialRoomName: string;
  hostToken: string;
}

export function HostStudio({
  roomCode,
  initialRoomName,
  hostToken
}: HostStudioProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureManagerRef = useRef<ScreenCaptureManager | null>(null);
  const adapterRef = useRef<VdoNinjaAdapter | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.INITIALIZING);
  const [statusText, setStatusText] = useState("พร้อมสำหรับการแชร์หน้าจอ");
  const [stats, setStats] = useState<MediaQualityStats | null>(null);
  const [metadata, setMetadata] = useState<CaptureMetadata | null>(null);
  const [viewersCount, setViewersCount] = useState(0);

  // Modals & Panels
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Invite URL
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomCode}`
      : `https://kshare.app/room/${roomCode}`;

  useEffect(() => {
    // Initialize ScreenShare Adapter
    const adapter = new VdoNinjaAdapter({ enableTurnFallback: true });
    adapterRef.current = adapter;

    adapter.onStateChange((newStatus, detail) => {
      setStatus(newStatus);
      if (detail) setStatusText(detail);
    });

    adapter.onStatsUpdate((newStats) => {
      setStats(newStats);
    });

    adapter.onPeerJoin((_peerId) => {
      setViewersCount((prev) => Math.min(prev + 1, 1));
      toast.success("มีผู้ชมเชื่อมต่อเข้ามาในห้องแล้ว");
    });

    adapter.onPeerLeave((_peerId) => {
      setViewersCount((prev) => Math.max(prev - 1, 0));
      toast.info("ผู้ชมออกจากห้องแล้ว");
    });

    adapter.connect({
      roomCode,
      role: UserRole.HOST
    });

    // Polling room metadata to track viewers
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            setViewersCount(data.room.activeViewersCount || 0);
          }
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      if (captureManagerRef.current) {
        captureManagerRef.current.stopCapture();
      }
      adapter.disconnect();
    };
  }, [roomCode]);

  const handleStartShare = async () => {
    try {
      if (!captureManagerRef.current) {
        captureManagerRef.current = new ScreenCaptureManager();
      }

      captureManagerRef.current.onEnded(() => {
        handleStopShare();
        toast.info("คุณได้หยุดการแชร์หน้าจอจากเบราว์เซอร์");
      });

      const { stream, metadata: meta } = await captureManagerRef.current.startCapture({
        frameRate: 60,
        resolution: "1080p",
        includeAudio: audioEnabled
      });

      setMetadata(meta);
      setIsSharing(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      if (adapterRef.current) {
        await adapterRef.current.publish(stream);
      }

      // Update room status on server
      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostToken,
          status: RoomStatus.ACTIVE,
          streamId: `kshare_${roomCode.toLowerCase()}`
        })
      });

      toast.success("เริ่มแชร์หน้าจอเรียบร้อยแล้ว");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    }
  };

  const handleStopShare = async () => {
    if (captureManagerRef.current) {
      captureManagerRef.current.stopCapture();
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    setMetadata(null);

    // Update room status on server
    try {
      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostToken,
          status: RoomStatus.IDLE
        })
      });
    } catch {
      // ignore
    }

    toast.info("หยุดการแชร์หน้าจอแล้ว");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("คัดลอกลิงก์เชิญแล้ว");
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative text-foreground">
      {/* Top Studio Bar */}
      <div className="h-14 border-b border-border/50 bg-background/90 backdrop-blur-xl px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="text-xs h-8 px-2 text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            แดชบอร์ด
          </Button>

          <div className="h-4 w-px bg-border/60" />

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">{initialRoomName}</span>
            <Badge
              variant={isSharing ? "live" : "secondary"}
              dot
              pulse={isSharing}
              className="font-mono text-xs uppercase"
            >
              {roomCode}
            </Badge>
          </div>
        </div>

        {/* Viewers & Invite Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/60 text-xs">
            <Users className="h-3.5 w-3.5 text-orange-400" />
            <span className="font-mono font-medium">{viewersCount}/1</span>
            <span className="text-muted-foreground hidden sm:inline">ผู้ชม</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <QrCode className="h-3.5 w-3.5 text-primary" />
            เชิญผู้ชม (Invite)
          </Button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <main className="flex-1 p-3 sm:p-6 flex flex-col items-center justify-center relative">
        <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black/90 border border-border/80 shadow-2xl relative flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${isSharing ? "block" : "hidden"}`}
          />

          {!isSharing && (
            <div className="text-center p-6 flex flex-col items-center max-w-md">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-4 shadow-lg shadow-orange-500/10">
                <MonitorPlay className="h-8 w-8 animate-pulse" />
              </div>
              <h3 className="font-bold text-foreground text-xl mb-1.5">
                ห้องพร้อมสำหรับการแชร์หน้าจอ
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
                คลิกปุ่ม &quot;เริ่มแชร์หน้าจอ&quot; เพื่อเลือกหน้าจอ แอพ หรือแท็บที่คุณต้องการสตรีมไปยังผู้ชมแบบ 1:1 P2P
              </p>
              <Button
                variant="gradient"
                size="lg"
                onClick={handleStartShare}
                className="font-semibold text-sm shadow-xl shadow-orange-500/25"
              >
                <MonitorPlay className="h-4 w-4 mr-2" />
                เริ่มแชร์หน้าจอ
              </Button>
            </div>
          )}

          {/* Top Floating HUD Badges */}
          {isSharing && (
            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
              <Badge variant="live" dot pulse>
                LIVE STREAMING
              </Badge>
              {metadata && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {metadata.width}×{metadata.height}
                </Badge>
              )}
              {stats?.frameRate && (
                <Badge variant="cyber" className="font-mono text-xs">
                  {stats.frameRate} FPS
                </Badge>
              )}
              {stats?.latencyMs && (
                <Badge variant="outline" className="font-mono text-xs bg-black/60 backdrop-blur-md">
                  {stats.latencyMs}ms Latency
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Floating Bottom Control Dock */}
        <div className="mt-4 w-full max-w-xl">
          <Card className="p-2 sm:p-2.5 bg-card/90 border-border/80 backdrop-blur-2xl shadow-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isSharing ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopShare}
                  className="font-semibold text-xs gap-1.5"
                >
                  <StopCircle className="h-4 w-4" />
                  หยุดแชร์หน้าจอ
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={handleStartShare}
                  className="font-semibold text-xs gap-1.5"
                >
                  <MonitorPlay className="h-4 w-4" />
                  เริ่มแชร์หน้าจอ
                </Button>
              )}

              <Button
                variant={audioEnabled ? "outline" : "secondary"}
                size="sm"
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="text-xs h-9"
                title={audioEnabled ? "ปิดเสียงระบบ" : "เปิดเสียงระบบ"}
              >
                {audioEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              {isSharing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePiP}
                  className="text-xs h-9 hidden sm:flex"
                  title="Picture-in-Picture"
                >
                  <Tv className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Connection Status indicator */}
            <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline font-mono text-[11px] truncate max-w-[140px]">
                {statusText}
              </span>
            </div>
          </Card>
        </div>
      </main>

      {/* Invite Modal with Fastory-style QR Code */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card glow className="w-full max-w-md p-6 bg-card/95 border-primary/30 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">
                  เชิญผู้รับชม (1:1 P2P Room)
                </h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-5">
              ส่งลิงก์หรือให้ผู้รับชมสแกน QR Code เพื่อเปิดรับชมภาพหน้าจอของคุณได้ทันทีโดยไม่ต้องติดตั้งโปรแกรม
            </p>

            {/* QR Code Container */}
            <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-inner mb-5">
              <QRCodeSVG value={inviteUrl} size={180} level="M" />
            </div>

            {/* Room Code Callout */}
            <div className="flex items-center justify-center gap-2 mb-4 p-2.5 rounded-xl bg-secondary/80 border border-border/70">
              <span className="text-xs text-muted-foreground">รหัสห้อง:</span>
              <span className="text-base font-bold font-mono tracking-wider text-primary">
                {roomCode}
              </span>
            </div>

            {/* Copy Invite Link */}
            <div className="flex items-center gap-2 mb-4">
              <Input
                readOnly
                value={inviteUrl}
                className="text-xs font-mono select-all bg-background"
              />
              <Button
                variant={copied ? "default" : "gradient"}
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0 font-semibold text-xs h-11"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInviteModal(false)}
              className="w-full text-xs font-medium"
            >
              ปิดหน้าต่าง
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
