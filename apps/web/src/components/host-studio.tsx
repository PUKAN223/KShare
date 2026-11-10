"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Card, Badge, Input } from "@kshare/ui";
import {
  MonitorPlay,
  StopCircle,
  Copy,
  Check,
  Users,
  QrCode,
  ArrowLeft,
  Volume2,
  VolumeX,
  Radio,
  Settings,
  Mic,
  MicOff,
  Lock,
  Unlock,
  Shield,
  Sliders,
  Sparkles,
  Wifi,
  Tv,
  Eye,
  RefreshCw
} from "lucide-react";
import { ScreenCaptureManager, CaptureMetadata } from "@kshare/capture";
import { WebRTCHostPeer } from "@/lib/webrtc-peer";
import { RoomStatus } from "@kshare/protocol";
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
  const peerRef = useRef<WebRTCHostPeer | null>(null);

  // Stream States
  const [isSharing, setIsSharing] = useState(false);
  const [statusText, setStatusText] = useState("พร้อมสำหรับการแชร์หน้าจอ");
  const [metadata, setMetadata] = useState<CaptureMetadata | null>(null);
  const [viewersCount, setViewersCount] = useState(0);

  // Settings: Video & Quality
  const [resolution, setResolution] = useState<"720p" | "1080p" | "1440p" | "4k">("1080p");
  const [frameRate, setFrameRate] = useState<number>(60);
  const [contentHint, setContentHint] = useState<"detail" | "motion">("detail");

  // Settings: Audio & Mic
  const [systemAudio, setSystemAudio] = useState(true);
  const [micAudio, setMicAudio] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);

  // Settings: Security & Classroom
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [roomPin, setRoomPin] = useState("");
  const [showWatermark, setShowWatermark] = useState(true);
  const [centerName, setCenterName] = useState("ศูนย์มหาวิทยาลัยกำกับดูแล");

  // Modals & Panels
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lanIp, setLanIp] = useState<string>("");

  useEffect(() => {
    fetch("/api/network-ip")
      .then((res) => res.json())
      .then((data) => {
        if (data.ip && data.ip !== "localhost") {
          setLanIp(data.ip);
        }
      })
      .catch(() => {});

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
    }, 4000);

    return () => {
      clearInterval(interval);
      if (captureManagerRef.current) {
        captureManagerRef.current.stopCapture();
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, [roomCode]);

  const getInviteUrl = () => {
    if (typeof window === "undefined") return `https://kshare.app/room/${roomCode}`;
    const port = window.location.port ? `:${window.location.port}` : "";
    const protocol = window.location.protocol;
    if (lanIp && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      return `${protocol}//${lanIp}${port}/room/${roomCode}`;
    }
    return `${window.location.origin}/room/${roomCode}`;
  };

  const inviteUrl = getInviteUrl();

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
        frameRate,
        resolution,
        includeAudio: systemAudio,
        contentHint
      });

      // If teacher microphone is enabled, mix mic track in
      if (micAudio) {
        await captureManagerRef.current.addMicrophoneTrack();
      }

      setMetadata(meta);
      setIsSharing(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      if (peerRef.current) {
        peerRef.current.close();
      }

      peerRef.current = new WebRTCHostPeer(roomCode, stream, (iceState) => {
        if (iceState === "connected" || iceState === "completed") {
          setStatusText("กำลังส่งสัญญาณสด (P2P Streaming Live)");
        } else if (iceState === "disconnected") {
          setStatusText("สัญญาณขาดหาย กำลังเชื่อมต่อใหม่...");
        }
      });

      await peerRef.current.start();

      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostToken,
          status: RoomStatus.ACTIVE,
          streamId: `kshare_${roomCode.toLowerCase()}`
        })
      });

      toast.success("เริ่มถ่ายทอดสดหน้าจอห้องเรียน วมว. เรียบร้อย");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    }
  };

  const handleStopShare = async () => {
    if (captureManagerRef.current) {
      captureManagerRef.current.stopCapture();
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    setMetadata(null);
    setStatusText("หยุดการแชร์หน้าจอแล้ว");

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

  const toggleMic = async () => {
    const nextMic = !micAudio;
    setMicAudio(nextMic);
    if (captureManagerRef.current && isSharing) {
      if (nextMic) {
        await captureManagerRef.current.addMicrophoneTrack();
        toast.success("เปิดไมโครโฟนผู้สอนแล้ว");
      } else {
        captureManagerRef.current.removeMicrophoneTrack();
        toast.info("ปิดไมโครโฟนผู้สอนแล้ว");
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("คัดลอกลิงก์ห้องเรียน วมว. แล้ว");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative text-foreground">
      {/* Top Academic Bar */}
      <div className="h-14 border-b border-primary/20 bg-background/95 backdrop-blur-md px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            แดชบอร์ด
          </Button>

          <div className="h-4 w-px bg-border/60" />

          {/* Organization Logo Small */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full overflow-hidden border border-primary/30 p-0.5 bg-black/40 hidden sm:flex items-center justify-center">
              <Image
                src="/scius-logo.png"
                alt="SCiUS Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <span className="font-semibold text-sm tracking-tight">{initialRoomName}</span>
            <Badge
              variant={isSharing ? "live" : "secondary"}
              dot
              pulse={isSharing}
              className="font-mono text-xs uppercase"
            >
              {roomCode}
            </Badge>
            {isRoomLocked && (
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5 gap-1">
                <Lock className="h-2.5 w-2.5" /> ล็อกห้อง
              </Badge>
            )}
          </div>
        </div>

        {/* Viewers & Quick Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/60 text-xs">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono font-medium">{viewersCount}/1</span>
            <span className="text-muted-foreground hidden sm:inline">นักเรียน</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsModal(true)}
            className="gap-1.5 text-xs font-medium border-primary/30 hover:border-primary"
            title="การตั้งค่าห้องและการสตรีม"
          >
            <Sliders className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">ตั้งค่าสตรีม</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <QrCode className="h-3.5 w-3.5" />
            เชิญนักเรียน
          </Button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <main className="flex-1 p-3 sm:p-5 flex flex-col items-center justify-center relative">
        <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black border border-primary/20 shadow-2xl relative flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${isSharing ? "block" : "hidden"}`}
          />

          {!isSharing && (
            <div className="text-center p-6 flex flex-col items-center max-w-md">
              <div className="h-16 w-16 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-lg shadow-primary/10">
                <MonitorPlay className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-foreground text-xl mb-1.5">
                ห้องเรียนวิทยาศาสตร์ วมว. พร้อมแชร์หน้าจอ
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
                คลิกปุ่ม &quot;เริ่มแชร์หน้าจอ&quot; เพื่อเลือกหน้าต่างสไลด์การสอน การเขียนโค้ด หรือสื่อการเรียนรู้แบบ Real-Time P2P
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleStartShare}
                  className="font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                >
                  <MonitorPlay className="h-4 w-4 mr-2" />
                  เริ่มแชร์หน้าจอ ({resolution} • {frameRate}FPS)
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowSettingsModal(true)}
                  className="text-xs"
                >
                  <Sliders className="h-4 w-4 mr-1.5 text-primary" />
                  ปรับความคมชัด
                </Button>
              </div>
            </div>
          )}

          {/* Watermark Overlay (SCiUS Logo & Room Code) */}
          {showWatermark && (
            <div className="absolute bottom-4 right-4 z-10 pointer-events-none flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 opacity-75">
              <Image
                src="/scius-logo.png"
                alt="SCiUS"
                width={20}
                height={20}
                className="object-contain"
              />
              <span className="text-[10px] font-mono tracking-wider text-white/90">
                SCiUS • {roomCode}
              </span>
            </div>
          )}

          {/* Top Live Badges */}
          {isSharing && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge variant="live" dot pulse>
                LIVE CLASSROOM
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs border-primary/30">
                {resolution.toUpperCase()} • {frameRate}FPS
              </Badge>
              {micAudio && (
                <Badge variant="success" className="text-[10px] gap-1">
                  <Mic className="h-3 w-3" /> ไมค์เปิดอยู่
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Minimalist Bottom Control Dock */}
        <div className="mt-4 w-full max-w-xl">
          <Card className="p-2 bg-card/95 border-border/80 backdrop-blur-xl shadow-xl flex items-center justify-between gap-2">
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
                  variant="default"
                  size="sm"
                  onClick={handleStartShare}
                  className="font-semibold text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <MonitorPlay className="h-4 w-4" />
                  เริ่มแชร์หน้าจอ
                </Button>
              )}

              {/* Mic Toggle */}
              <Button
                variant={micAudio ? "default" : "outline"}
                size="sm"
                onClick={toggleMic}
                className={`text-xs h-9 px-2.5 ${micAudio ? "bg-emerald-600 text-white" : ""}`}
                title={micAudio ? "ปิดไมค์ผู้สอน" : "เปิดไมค์ผู้สอน"}
              >
                {micAudio ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              {/* System Audio Toggle */}
              <Button
                variant={systemAudio ? "outline" : "secondary"}
                size="sm"
                onClick={() => setSystemAudio(!systemAudio)}
                className="text-xs h-9 px-2.5"
                title={systemAudio ? "ปิดเสียงคอมพิวเตอร์" : "เปิดเสียงคอมพิวเตอร์"}
              >
                {systemAudio ? (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              {/* Settings Trigger */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettingsModal(true)}
                className="text-xs h-9 px-2.5 text-muted-foreground hover:text-foreground"
                title="การตั้งค่าห้องและการสตรีม"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pr-2 font-mono text-[11px]">
              <span className={`h-2 w-2 rounded-full ${isSharing ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`} />
              <span className="truncate max-w-[140px]">{statusText}</span>
            </div>
          </Card>
        </div>
      </main>

      {/* Comprehensive Host Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <Card glow className="w-full max-w-lg p-6 bg-card border-primary/30 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    การตั้งค่าโฮสต์ห้องเรียน (Host Settings)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ปรับแต่งความละเอียดเสียง และสิทธิ์การเข้าถึงห้องเรียน วมว.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* 1. Video & Quality Settings */}
              <div>
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Tv className="h-3.5 w-3.5" />
                  1. คุณภาพและความละเอียดภาพหน้าจอ
                </h4>
                
                {/* Resolution preset */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    ความละเอียด (Resolution)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["720p", "1080p", "1440p", "4k"] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => {
                          setResolution(res);
                          toast.info(`ตั้งค่าความละเอียด: ${res.toUpperCase()}`);
                        }}
                        className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                          resolution === res
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frame Rate preset */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    เฟรมเรท (Frame Rate)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { fps: 15, label: "15 FPS (สไลด์)" },
                      { fps: 30, label: "30 FPS (มาตรฐาน)" },
                      { fps: 60, label: "60 FPS (ลื่นไหล)" }
                    ].map((item) => (
                      <button
                        key={item.fps}
                        type="button"
                        onClick={() => setFrameRate(item.fps)}
                        className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                          frameRate === item.fps
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Hint */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    การเรนเดอร์เนื้อหา (Content Hint)
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setContentHint("detail")}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        contentHint === "detail"
                          ? "bg-primary/10 border-primary text-foreground font-semibold"
                          : "bg-secondary/40 border-border text-muted-foreground"
                      }`}
                    >
                      <div className="font-medium text-xs mb-0.5">Detail Mode (แนะนำ)</div>
                      <div className="text-[11px] text-muted-foreground">เน้นตัวหนังสือ โค้ด และสูตรคำนวณคมชัด ไม่เบลอ</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentHint("motion")}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        contentHint === "motion"
                          ? "bg-primary/10 border-primary text-foreground font-semibold"
                          : "bg-secondary/40 border-border text-muted-foreground"
                      }`}
                    >
                      <div className="font-medium text-xs mb-0.5">Motion Mode</div>
                      <div className="text-[11px] text-muted-foreground">เน้นความต่อเนื่องเมื่อเปิดวิดีโอหรืออนิเมชัน</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Audio & Mic Settings */}
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5" />
                  2. ระบบเสียงและไมโครโฟน
                </h4>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                    <div>
                      <div className="text-xs font-medium text-foreground">แชร์เสียงระบบคอมพิวเตอร์ (System Audio)</div>
                      <div className="text-[11px] text-muted-foreground">ส่งเสียงจากโปรแกรมหรือวิดีโอที่เปิดบนคอมพิวเตอร์</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemAudio}
                      onChange={(e) => setSystemAudio(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                    <div>
                      <div className="text-xs font-medium text-foreground">ไมโครโฟนผู้สอน (Teacher Microphone)</div>
                      <div className="text-[11px] text-muted-foreground">ส่งเสียงบรรยายของผู้สอนรวมเข้ากับสตรีม</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={micAudio}
                      onChange={(e) => {
                        setMicAudio(e.target.checked);
                        if (isSharing) toggleMic();
                      }}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                    <div>
                      <div className="text-xs font-medium text-foreground">ระบบตัดเสียงสะท้อนและเสียงรบกวน (Noise Suppression)</div>
                      <div className="text-[11px] text-muted-foreground">เพิ่มความคมชัดของเสียงพูด</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={noiseSuppression}
                      onChange={(e) => setNoiseSuppression(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Security & Classroom Management */}
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  3. ความปลอดภัยและจัดการห้องเรียน
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                    <div>
                      <div className="text-xs font-medium text-foreground">ล็อกห้องเรียน (Lock Room)</div>
                      <div className="text-[11px] text-muted-foreground">ไม่อนุญาตให้นักเรียนคนใหม่เข้าร่วมหลังจากเริ่มสอน</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRoomLocked(!isRoomLocked);
                        toast.info(isRoomLocked ? "ปลดล็อกห้องเรียนแล้ว" : "ล็อกห้องเรียนเรียบร้อย");
                      }}
                      className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                        isRoomLocked
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {isRoomLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                    <div>
                      <div className="text-xs font-medium text-foreground">แสดงลายน้ำ วมว. (SCiUS Watermark)</div>
                      <div className="text-[11px] text-muted-foreground">แสดงตราสัญลักษณ์ วมว. และรหัสห้องที่มุมจอ</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={showWatermark}
                      onChange={(e) => setShowWatermark(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setShowSettingsModal(false);
                  toast.success("บันทึกการตั้งค่าโฮสต์แล้ว (มีผลทันที)");
                }}
                className="bg-primary text-primary-foreground font-semibold text-xs"
              >
                เสร็จสิ้น
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Production Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <Card glow className="w-full max-w-md p-6 bg-card border-primary/30 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-primary/40 p-0.5 bg-black/40 flex items-center justify-center">
                  <Image
                    src="/scius-logo.png"
                    alt="SCiUS"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <h3 className="font-bold text-lg text-foreground">
                  เชิญนักเรียนเข้าห้องเรียน วมว.
                </h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              ส่งลิงก์หรือให้นักเรียนสแกน QR Code บนไอแพดหรืออุปกรณ์ที่ต้องการรับชม
            </p>

            <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-sm mb-4">
              <QRCodeSVG value={inviteUrl} size={180} level="M" />
            </div>

            <div className="flex items-center justify-center gap-2 mb-4 p-2 rounded-xl bg-secondary/80 border border-border/70">
              <span className="text-xs text-muted-foreground">รหัสห้องเรียน:</span>
              <span className="text-base font-bold font-mono tracking-wider text-primary">
                {roomCode}
              </span>
            </div>

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
