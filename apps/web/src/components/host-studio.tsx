"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Tv
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

  const [isSharing, setIsSharing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [statusText, setStatusText] = useState("พร้อมสำหรับการแชร์หน้าจอ");
  const [metadata, setMetadata] = useState<CaptureMetadata | null>(null);
  const [viewersCount, setViewersCount] = useState(0);

  // Modals & Panels
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

      // Initialize WebRTC P2P Peer Connection for broadcast
      if (peerRef.current) {
        peerRef.current.close();
      }

      peerRef.current = new WebRTCHostPeer(roomCode, stream, (iceState) => {
        if (iceState === "connected" || iceState === "completed") {
          setStatusText("เชื่อมต่อกับผู้ชมเรียบร้อย (P2P Streaming)");
        } else if (iceState === "disconnected") {
          setStatusText("สัญญาณขาดหาย กำลังเชื่อมต่อใหม่...");
        }
      });

      await peerRef.current.start();

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

      toast.success("เริ่มแชร์หน้าจอแล้ว พร้อมส่งสัญญาณภาพไปยังผู้ชม");
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("คัดลอกลิงก์เชิญแล้ว");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative text-foreground">
      {/* Clean Production Top Bar */}
      <div className="h-14 border-b border-border/50 bg-background/95 backdrop-blur-md px-4 flex items-center justify-between">
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

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{initialRoomName}</span>
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

        {/* Viewers indicator & Quick Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/60 text-xs">
            <Users className="h-3.5 w-3.5 text-primary" />
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
            เชิญผู้ชม
          </Button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <main className="flex-1 p-3 sm:p-6 flex flex-col items-center justify-center relative">
        <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black border border-border/80 shadow-2xl relative flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${isSharing ? "block" : "hidden"}`}
          />

          {!isSharing && (
            <div className="text-center p-6 flex flex-col items-center max-w-md">
              <div className="h-16 w-16 rounded-2xl bg-secondary/80 border border-border/60 flex items-center justify-center text-primary mb-4">
                <MonitorPlay className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-foreground text-xl mb-1.5">
                ห้องพร้อมสำหรับการแชร์หน้าจอ
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
                คลิกปุ่ม &quot;เริ่มแชร์หน้าจอ&quot; เพื่อเลือกหน้าจอหรือหน้าต่างที่ต้องการส่งให้ผู้ชม
              </p>
              <Button
                variant="gradient"
                size="lg"
                onClick={handleStartShare}
                className="font-semibold text-sm shadow-lg shadow-primary/20"
              >
                <MonitorPlay className="h-4 w-4 mr-2" />
                เริ่มแชร์หน้าจอ
              </Button>
            </div>
          )}

          {isSharing && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge variant="live" dot pulse>
                LIVE
              </Badge>
              {metadata && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {metadata.width}×{metadata.height}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Minimalist Production Dock */}
        <div className="mt-4 w-full max-w-lg">
          <Card className="p-2 bg-card/95 border-border/80 backdrop-blur-xl shadow-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
                className="text-xs h-9 px-3"
                title={audioEnabled ? "ปิดเสียงระบบ" : "เปิดเสียงระบบ"}
              >
                {audioEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-400 mr-1" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground mr-1" />
                )}
                <span className="hidden sm:inline text-xs">เสียง</span>
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pr-2 font-mono text-[11px]">
              <span className={`h-2 w-2 rounded-full ${isSharing ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`} />
              <span className="truncate max-w-[150px]">{statusText}</span>
            </div>
          </Card>
        </div>
      </main>

      {/* Production Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <Card glow className="w-full max-w-md p-6 bg-card border-border/80 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">
                  เชิญผู้รับชม
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
              ส่งลิงก์หรือให้ผู้รับชมสแกน QR Code บนไอแพดหรืออุปกรณ์อื่นเพื่อรับชมได้ทันที
            </p>

            <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-sm mb-4">
              <QRCodeSVG value={inviteUrl} size={180} level="M" />
            </div>

            <div className="flex items-center justify-center gap-2 mb-4 p-2 rounded-xl bg-secondary/80 border border-border/70">
              <span className="text-xs text-muted-foreground">รหัสห้อง:</span>
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
