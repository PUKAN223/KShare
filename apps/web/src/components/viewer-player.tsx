"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RoomStatus, formatRoomCode } from "@kshare/protocol";
import { WebRTCViewerPeer, LiveStreamMetrics } from "@/lib/webrtc-peer";
import {
  RoomHostSettings,
  WatermarkPosition,
  getDefaultRoomSettings
} from "@/lib/room-store";
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RefreshCw,
  ArrowLeft,
  Camera,
  ZoomIn,
  ZoomOut,
  Pause,
  Radio,
  Sparkles,
  Check
} from "lucide-react";

interface ViewerPlayerProps {
  roomCode: string;
  roomName: string;
  subject?: string;
  viewerId: string;
  initialStatus: RoomStatus;
  initialSettings?: RoomHostSettings;
}

const POSITION_CLASSES: Record<WatermarkPosition, string> = {
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4"
};

export function ViewerPlayer({
  roomCode,
  roomName,
  subject = "ทั่วไป",
  viewerId,
  initialStatus,
  initialSettings
}: ViewerPlayerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<WebRTCViewerPeer | null>(null);

  const [status, setStatus] = useState<RoomStatus>(initialStatus);
  const [settings, setSettings] = useState<RoomHostSettings>(
    () => initialSettings || getDefaultRoomSettings(roomCode)
  );
  const [inboundStream, setInboundStream] = useState<MediaStream | null>(null);
  const [peerState, setPeerState] = useState<string>("connecting");
  const [kicked, setKicked] = useState(false);

  // Player controls
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const [metrics, setMetrics] = useState<LiveStreamMetrics>({
    bitrateKbps: 0,
    frameRate: 60,
    width: 1920,
    height: 1080,
    rttMs: 14,
    connectedPeers: 1,
    transportMode: "P2P Direct"
  });

  // Start WebRTC viewer peer for this viewerId
  useEffect(() => {
    const peer = new WebRTCViewerPeer(
      roomCode,
      viewerId,
      (remoteStream) => {
        setInboundStream((prev) => {
          if (prev && prev.id === remoteStream.id) {
            return new MediaStream(remoteStream.getTracks());
          }
          return remoteStream;
        });
        setStatus(RoomStatus.LIVE);
      },
      (state) => {
        setPeerState(state);
      },
      (liveMetrics) => {
        setMetrics(liveMetrics);
      }
    );

    peer.start();
    peerRef.current = peer;

    return () => {
      peer.close();
      peerRef.current = null;
    };
  }, [roomCode, viewerId]);

  // Bind MediaStream to <video> whenever stream or status updates
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !inboundStream) return;

    if (videoEl.srcObject !== inboundStream) {
      videoEl.srcObject = inboundStream;
    }

    videoEl.muted = isMuted;
    videoEl.play().catch(() => {
      // Fallback: keep muted so iPad Safari allows autoplay
      videoEl.muted = true;
      setIsMuted(true);
      videoEl.play().catch(() => {});
    });
  }, [inboundStream, status, isMuted]);

  // Poll room status, settings, and send viewer heartbeat
  useEffect(() => {
    const pollRoom = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomCode}?viewerId=${encodeURIComponent(viewerId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.kicked) {
          setKicked(true);
          peerRef.current?.close();
          return;
        }
        if (data.room) {
          setStatus(data.room.status);
          if (data.room.settings) {
            setSettings(data.room.settings);
          }
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(pollRoom, 3000);
    return () => clearInterval(interval);
  }, [roomCode, viewerId]);

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    await peerRef.current?.requestFreshOffer();
    setTimeout(() => setReconnecting(false), 900);
  }, []);

  const handleSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `KShare-${roomCode}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    setSnapshotSaved(true);
    setTimeout(() => setSnapshotSaved(false), 2000);
  };

  const handleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      return;
    }

    if (container && typeof container.requestFullscreen === "function") {
      container
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          if (video?.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
          }
        });
    } else if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  };

  const cycleZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(2.5, Math.max(1, next));
    });
  };

  if (kicked) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full p-6 rounded-2xl bg-zinc-900 border border-white/10 text-center space-y-4">
          <h2 className="text-base font-bold text-zinc-100">เซสชันสิ้นสุดลง</h2>
          <p className="text-xs text-zinc-400">คุณถูกนำออกจากห้องนี้แล้ว</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-xs"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const hasVideoStream = Boolean(inboundStream && status === RoomStatus.LIVE);

  return (
    <div
      ref={containerRef}
      className="h-screen bg-[#09090b] text-zinc-100 flex flex-col overflow-hidden select-none"
    >
      {/* Top Sleek Viewer Bar */}
      <header className="h-13 border-b border-white/[0.08] bg-zinc-950/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ออก</span>
          </button>

          <h1 className="font-semibold text-sm text-zinc-100 truncate">
            {roomName}
          </h1>

          <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-zinc-900 border border-white/[0.07] font-mono text-xs text-zinc-400">
            {formatRoomCode(roomCode)}
          </span>
        </div>

        {/* Right Telemetry + Student Controls */}
        <div className="flex items-center gap-1.5">
          {hasVideoStream && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/[0.07] text-[11px] font-mono text-zinc-300 mr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {metrics.width}×{metrics.height}
              </span>
              <span className="text-zinc-600">•</span>
              <span>{metrics.frameRate}fps</span>
              <span className="text-zinc-600">•</span>
              <span className="text-amber-400">{metrics.rttMs}ms</span>
            </div>
          )}

          {/* Zoom Controls */}
          {hasVideoStream && (
            <div className="hidden sm:flex items-center bg-zinc-900 border border-white/[0.08] rounded-lg p-0.5">
              <button
                onClick={() => cycleZoom(-0.25)}
                disabled={zoomLevel <= 1}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                title="ซูมออก"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-1.5 text-[11px] font-mono text-zinc-300"
                title="รีเซ็ตซูม"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => cycleZoom(0.25)}
                disabled={zoomLevel >= 2.5}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                title="ซูมเข้าดูรายละเอียด"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Fit / Fill Toggle */}
          {hasVideoStream && (
            <button
              onClick={() =>
                setFitMode((m) => (m === "contain" ? "cover" : "contain"))
              }
              className="hidden md:flex h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] items-center gap-1 text-xs text-zinc-300"
              title="สลับสัดส่วนภาพ"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{fitMode === "contain" ? "พอดีจอ" : "เต็มจอ"}</span>
            </button>
          )}

          {/* Save Slide Snapshot */}
          {hasVideoStream && (
            <button
              onClick={handleSnapshot}
              className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] flex items-center gap-1.5 text-xs text-zinc-200 transition-colors"
              title="บันทึกภาพสไลด์ปัจจุบัน (PNG)"
            >
              {snapshotSaved ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">
                {snapshotSaved ? "บันทึกแล้ว" : "แคปสไลด์"}
              </span>
            </button>
          )}

          {/* Reconnect / Refresh Stream */}
          <button
            onClick={handleReconnect}
            className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] flex items-center gap-1.5 text-xs text-zinc-300 transition-colors"
            title="รีเฟรชสัญญาณภาพใหม่"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${reconnecting ? "animate-spin text-amber-400" : ""}`}
            />
            <span className="hidden lg:inline">รีเฟรช</span>
          </button>

          {/* Audio Mute/Unmute */}
          <button
            onClick={handleToggleMute}
            className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-colors ${
              isMuted
                ? "bg-zinc-900 border-white/[0.08] text-zinc-400"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isMuted ? "ปิดเสียง" : "เปิดเสียง"}
            </span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="h-8 w-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] flex items-center justify-center text-zinc-300"
            title="ขยายเต็มหน้าจอ"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Video Stage */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-auto">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center"
          }}
          className={`w-full h-full transition-transform duration-150 ${
            fitMode === "contain" ? "object-contain" : "object-cover"
          } ${
            hasVideoStream && !settings.isPaused ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Tap to Unmute Floating Pill on iPad/Mobile */}
        {hasVideoStream && !settings.isPaused && isMuted && (
          <button
            onClick={handleToggleMute}
            className="absolute top-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 shadow-xl backdrop-blur-md transition-all"
          >
            <VolumeX className="w-4 h-4" />
            <span>แตะเพื่อเปิดเสียง</span>
          </button>
        )}

        {/* Subtle Corner Watermark (Synced with Host Settings) */}
        {hasVideoStream && settings.watermark?.enabled && (
          <div
            style={{ opacity: (settings.watermark.opacity || 75) / 100 }}
            className={`absolute ${
              POSITION_CLASSES[settings.watermark.position || "bottom-right"]
            } pointer-events-none z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-950/65 backdrop-blur-md border border-white/10 shadow-lg`}
          >
            {settings.watermark.showLogo && (
              <img
                src="/scius-logo.png"
                alt="Watermark"
                className="w-6 h-6 object-contain rounded-full"
              />
            )}
            {settings.watermark.text && (
              <span className="text-[11px] font-medium text-zinc-200 tracking-wide">
                {settings.watermark.text}
              </span>
            )}
          </div>
        )}

        {/* Host Paused / Freeze Screen State */}
        {hasVideoStream && settings.isPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md p-6 text-center z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
              <Pause className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-bold text-zinc-100">
              พักการแสดงหน้าจอชั่วคราว
            </h2>
          </div>
        )}

        {/* Waiting / Connecting State */}
        {!hasVideoStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-studio-grid p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-3">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-sm font-bold text-zinc-100 mb-4">
              {status === RoomStatus.LIVE
                ? "กำลังเชื่อมต่อสัญญาณภาพ..."
                : "รอเริ่มแชร์หน้าจอ"}
            </h2>
            {status === RoomStatus.LIVE && (
              <button
                onClick={handleReconnect}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? "animate-spin" : ""}`} />
                <span>รีเฟรชสัญญาณ</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
