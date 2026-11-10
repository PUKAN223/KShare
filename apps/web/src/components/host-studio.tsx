"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { captureManager } from "@kshare/capture";
import { RoomStatus, formatRoomCode } from "@kshare/protocol";
import { QRCodeSVG } from "qrcode.react";
import { WebRTCHostPeer, LiveStreamMetrics } from "@/lib/webrtc-peer";
import {
  RoomHostSettings,
  ViewerParticipant,
  WatermarkPosition,
  getDefaultRoomSettings
} from "@/lib/room-store";
import {
  Monitor,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  StopCircle,
  Copy,
  Check,
  Users,
  Sliders,
  QrCode,
  RefreshCw,
  ArrowLeft,
  X,
  Lock,
  Unlock,
  Pause,
  Play,
  Stamp,
  UserX,
  Shield,
  Gauge,
  Sparkles,
  Tv
} from "lucide-react";

interface HostStudioProps {
  roomCode: string;
  roomName: string;
  subject?: string;
  hostToken: string;
  initialSettings?: RoomHostSettings;
}

const POSITION_CLASSES: Record<WatermarkPosition, string> = {
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4"
};

export function HostStudio({
  roomCode,
  roomName,
  subject = "ทั่วไป",
  hostToken,
  initialSettings
}: HostStudioProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<WebRTCHostPeer | null>(null);

  const [status, setStatus] = useState<RoomStatus>(RoomStatus.IDLE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [settings, setSettings] = useState<RoomHostSettings>(
    () => initialSettings || getDefaultRoomSettings(roomCode)
  );
  const [participants, setParticipants] = useState<ViewerParticipant[]>([]);

  // Media toggles & devices
  const [micEnabled, setMicEnabled] = useState(false);
  const [systemAudio, setSystemAudio] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  // Sidebar & UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"settings" | "viewers">("settings");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live WebRTC telemetry
  const [peerState, setPeerState] = useState<string>("waiting");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [metrics, setMetrics] = useState<LiveStreamMetrics>({
    bitrateKbps: 0,
    frameRate: settings.frameRate,
    width: 1920,
    height: 1080,
    rttMs: 12,
    connectedPeers: 0,
    transportMode: "P2P Direct"
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/room/${roomCode}`);
    }
  }, [roomCode]);

  // Enumerate microphone devices
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const mics = devices.filter((d) => d.kind === "audioinput");
          setAudioDevices(mics);
          if (mics.length > 0 && !selectedMicId) {
            setSelectedMicId(mics[0].deviceId);
          }
        })
        .catch(() => {});
    }
  }, [selectedMicId]);

  // Poll room state & connected participants
  useEffect(() => {
    const syncRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data. room?.participants)) {
            setParticipants(data.room.participants);
          }
        }
      } catch {
        // ignore
      }
    };
    syncRoom();
    const timer = setInterval(syncRoom, 3000);
    return () => clearInterval(timer);
  }, [roomCode]);

  // Elapsed broadcast timer
  useEffect(() => {
    if (status !== RoomStatus.LIVE) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Persist setting changes to backend & apply live constraints
  const patchSettings = useCallback(
    async (partial: Partial<RoomHostSettings>) => {
      setSettings((prev) => {
        const next: RoomHostSettings = {
          ...prev,
          ...partial,
          watermark: {
            ...prev.watermark,
            ...(partial.watermark || {})
          }
        };

        // Apply live video track constraints if resolution/fps/contentHint changed
        if (
          partial.resolution !== undefined ||
          partial.frameRate !== undefined ||
          partial.contentHint !== undefined
        ) {
          captureManager
            .applyVideoSettings({
              resolution: next.resolution,
              frameRate: next.frameRate,
              contentHint: next.contentHint
            })
            .catch(() => {});
        }

        // Apply live WebRTC RTP sender parameters if bitrate/degradation changed
        if (
          partial.maxBitrateKbps !== undefined ||
          partial.degradationPreference !== undefined
        ) {
          peerRef.current
            ?.updateEncodingParameters({
              maxBitrateKbps: next.maxBitrateKbps,
              degradationPreference: next.degradationPreference
            })
            .catch(() => {});
        }

        // Persist to room API
        fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostToken,
            settings: partial
          })
        }).catch(() => {});

        return next;
      });
    },
    [roomCode, hostToken]
  );

  // Attach local preview stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerRef.current?.close();
      captureManager.stopCapture();
    };
  }, []);

  const handleStartBroadcast = async () => {
    setErrorMsg(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      setErrorMsg(
        "เบราว์เซอร์ต้องรันบน localhost หรือ HTTPS จึงจะแชร์หน้าจอได้ (ผู้ชมบน iPad สามารถเข้าดูผ่าน IP เครื่องโฮสต์ได้ตามปกติ)"
      );
      return;
    }

    try {
      setStatus(RoomStatus.PREPARING);

      const { stream: mediaStream } = await captureManager.startCapture({
        resolution: settings.resolution,
        frameRate: settings.frameRate,
        includeAudio: systemAudio,
        contentHint: settings.contentHint
      });

      if (micEnabled) {
        await captureManager.addMicrophoneTrack({
          deviceId: selectedMicId || undefined
        });
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          handleStopBroadcast();
        };
      }

      setStream(mediaStream);
      setStatus(RoomStatus.LIVE);

      if (settings.isPaused) {
        await patchSettings({ isPaused: false });
      }

      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostToken,
          status: RoomStatus.LIVE,
          streamId: mediaStream.id
        })
      });

      if (peerRef.current) {
        peerRef.current.close();
      }

      const hostPeer = new WebRTCHostPeer(
        roomCode,
        mediaStream,
        (state) => setPeerState(state),
        (liveMetrics) => setMetrics(liveMetrics),
        {
          maxBitrateKbps: settings.maxBitrateKbps,
          degradationPreference: settings.degradationPreference
        }
      );
      await hostPeer.start();
      peerRef.current = hostPeer;
    } catch (err: unknown) {
      console.error("Failed to start capture:", err);
      setStatus(RoomStatus.IDLE);
    }
  };

  const handleStopBroadcast = async () => {
    peerRef.current?.close();
    peerRef.current = null;
    captureManager.stopCapture();
    setStream(null);
    setStatus(RoomStatus.IDLE);
    setPeerState("waiting");

    await fetch(`/api/rooms/${roomCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostToken,
        status: RoomStatus.IDLE
      })
    }).catch(() => {});
  };

  const handleTogglePause = async () => {
    const nextPaused = !settings.isPaused;
    captureManager.setVideoPaused(nextPaused);
    await patchSettings({ isPaused: nextPaused });
  };

  const handleToggleSystemAudio = () => {
    const next = !systemAudio;
    setSystemAudio(next);
    captureManager.setSystemAudioEnabled(next);
  };

  const handleToggleMic = async () => {
    const next = !micEnabled;
    setMicEnabled(next);
    if (status === RoomStatus.LIVE) {
      if (next) {
        await captureManager.addMicrophoneTrack({
          deviceId: selectedMicId || undefined
        });
      } else {
        captureManager.removeMicrophoneTrack();
      }
      const currentStream = captureManager.getCurrentStream();
      if (currentStream && peerRef.current) {
        await peerRef.current.syncStreamTracks(currentStream);
      }
    }
  };

  const handleChangeMicDevice = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    if (micEnabled && status === RoomStatus.LIVE) {
      await captureManager.addMicrophoneTrack({ deviceId });
      const currentStream = captureManager.getCurrentStream();
      if (currentStream && peerRef.current) {
        await peerRef.current.syncStreamTracks(currentStream);
      }
    }
  };

  const handleKickViewer = async (viewerId: string) => {
    await fetch(`/api/rooms/${roomCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostToken,
        kickViewerId: viewerId
      })
    }).catch(() => {});
    setParticipants((prev) => prev.filter((p) => p.viewerId !== viewerId));
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(formatRoomCode(roomCode));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const bitrateMbps =
    metrics.bitrateKbps > 0
      ? (metrics.bitrateKbps / 1000).toFixed(1)
      : (settings.maxBitrateKbps / 1000).toFixed(1);

  return (
    <div className="h-screen bg-[#09090b] text-zinc-100 flex flex-col overflow-hidden select-none">
      {/* Top Broadcast Console Bar */}
      <header className="h-14 border-b border-white/[0.08] bg-zinc-950/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              handleStopBroadcast();
              router.push("/");
            }}
            className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 text-xs font-medium transition-colors"
            title="กลับหน้าหลัก"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ออก</span>
          </button>

          <div className="h-4 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium shrink-0">
              {subject}
            </span>
            <h1 className="font-semibold text-sm text-zinc-100 truncate max-w-[180px] sm:max-w-[260px]">
              {roomName}
            </h1>
          </div>

          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-xs font-mono tracking-wider text-amber-400 transition-colors shrink-0"
            title="คัดลอกรหัสห้อง"
          >
            <span>{formatRoomCode(roomCode)}</span>
            {copiedCode ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-500" />
            )}
          </button>
        </div>

        {/* Center Telemetry Strip */}
        <div className="hidden lg:flex items-center gap-2 bg-zinc-900/90 border border-white/[0.07] rounded-lg px-3 py-1 text-xs">
          {status === RoomStatus.LIVE ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
              <span className="text-zinc-600">•</span>
              <span className="font-mono text-zinc-300 tabular-nums">
                {formatElapsed(elapsedSeconds)}
              </span>
              <span className="text-zinc-700">|</span>
              <span className="font-mono text-zinc-300 tabular-nums">
                {metrics.width}×{metrics.height}
              </span>
              <span className="text-zinc-700">|</span>
              <span className="font-mono text-zinc-300 tabular-nums">
                {metrics.frameRate} FPS
              </span>
              <span className="text-zinc-700">|</span>
              <span className="font-mono text-amber-400 tabular-nums">
                {bitrateMbps} Mbps
              </span>
              <span className="text-zinc-700">|</span>
              <span className="font-mono text-zinc-400 tabular-nums">
                {metrics.rttMs} ms
              </span>
            </>
          ) : (
            <span className="text-zinc-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              พร้อมแชร์หน้าจอ ({settings.resolution.toUpperCase()} @ {settings.frameRate}fps)
            </span>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSidebarOpen(true);
              setActiveTab("viewers");
            }}
            className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] flex items-center gap-1.5 text-xs text-zinc-300 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-semibold tabular-nums">
              {participants.length}
            </span>
            <span className="hidden sm:inline text-zinc-400">คนดู</span>
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className="h-8 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QR เข้าห้อง</span>
          </button>

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-colors ${
              sidebarOpen
                ? "bg-zinc-800 border-white/15 text-zinc-100"
                : "bg-zinc-900 border-white/[0.08] text-zinc-400 hover:text-zinc-200"
            }`}
            title="ตั้งค่าสตรีมและห้องเรียน"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden md:inline">ตั้งค่า</span>
          </button>
        </div>
      </header>

      {/* Main Workspace (Canvas + Inspector Sidebar) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Center Broadcast Stage */}
        <div className="flex-1 flex flex-col min-w-0 bg-studio-grid relative">
          {errorMsg && (
            <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-amber-400 hover:text-amber-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Video Viewport */}
          <div className="flex-1 p-4 flex items-center justify-center min-h-0">
            <div className="relative w-full h-full rounded-2xl bg-black border border-white/[0.08] shadow-2xl overflow-hidden flex items-center justify-center">
              {stream ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-contain transition-all duration-200 ${
                      settings.isPaused ? "opacity-25 blur-md scale-[0.99]" : "opacity-100"
                    }`}
                  />

                  {/* Freeze / Privacy Mode Overlay */}
                  {settings.isPaused && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/70 backdrop-blur-sm z-10">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3">
                        <Pause className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-zinc-100">
                        พักหน้าจอชั่วคราว (Freeze Mode)
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        ผู้ชมจะเห็นหน้าจอรอจนกว่าคุณจะกดเล่นต่อ
                      </p>
                      <button
                        onClick={handleTogglePause}
                        className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        แสดงหน้าจอต่อ
                      </button>
                    </div>
                  )}

                  {/* Subtle Corner Watermark Preview */}
                  {settings.watermark.enabled && (
                    <div
                      style={{ opacity: settings.watermark.opacity / 100 }}
                      className={`absolute ${
                        POSITION_CLASSES[settings.watermark.position]
                      } pointer-events-none z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-950/65 backdrop-blur-md border border-white/10 shadow-lg transition-all`}
                    >
                      {settings.watermark.showLogo && (
                        <img
                          src="/scius-logo.png"
                          alt="Watermark Logo"
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
                </>
              ) : (
                <div className="max-w-md text-center px-6 py-10">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5 text-amber-400 shadow-inner">
                    <Monitor className="w-8 h-8" />
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100 mb-2">
                    พร้อมแชร์หน้าจอเข้าห้องเรียน
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                    เลือกหน้าต่างโปรแกรม สไลด์การสอน หรือทั้งหน้าจอเพื่อเริ่มสตรีมแบบ P2P
                    ความหน่วงต่ำไปยัง iPad และอุปกรณ์ในห้องเรียน
                  </p>
                  <button
                    onClick={handleStartBroadcast}
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Monitor className="w-4 h-4" />
                    เลือกหน้าจอที่จะแชร์
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Floating Control Dock */}
          <div className=" pb-4 px-4 flex justify-center shrink-0">
            <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-900/95 border border-white/[0.09] shadow-2xl backdrop-blur-xl">
              {status === RoomStatus.LIVE ? (
                <>
                  <button
                    onClick={handleTogglePause}
                    className={`h-10 px-3.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                      settings.isPaused
                        ? "bg-amber-500 text-zinc-950 font-semibold"
                        : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200"
                    }`}
                    title="พักหน้าจอชั่วคราว"
                  >
                    {settings.isPaused ? (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>แสดงจอต่อ</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>พักหน้าจอ</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleStartBroadcast}
                    className="h-10 px-3.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center gap-2 transition-colors"
                    title="สลับหน้าต่างที่แชร์"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">สลับหน้าจอ</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartBroadcast}
                  className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center gap-2 transition-colors"
                >
                  <Monitor className="w-4 h-4" />
                  <span>เริ่มแชร์หน้าจอ</span>
                </button>
              )}

              <div className="h-5 w-px bg-white/[0.08] mx-1" />

              {/* System Audio Toggle */}
              <button
                onClick={handleToggleSystemAudio}
                className={`h-10 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  systemAudio
                    ? "bg-zinc-800/90 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                }`}
                title="เสียงระบบคอมพิวเตอร์"
              >
                {systemAudio ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                <span className="hidden md:inline">เสียงระบบ</span>
              </button>

              {/* Microphone Toggle */}
              <button
                onClick={handleToggleMic}
                className={`h-10 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  micEnabled
                    ? "bg-zinc-800/90 text-amber-400 border border-amber-500/25"
                    : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                }`}
                title="ไมโครโฟนผู้สอน"
              >
                {micEnabled ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
                <span className="hidden md:inline">ไมค์</span>
              </button>

              {/* Watermark Quick Toggle */}
              <button
                onClick={() =>
                  patchSettings({
                    watermark: {
                      ...settings.watermark,
                      enabled: !settings.watermark.enabled
                    }
                  })
                }
                className={`h-10 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  settings.watermark.enabled
                    ? "bg-zinc-800/90 text-amber-300 border border-amber-500/20"
                    : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                }`}
                title="เปิด/ปิดลายน้ำมุมจอ"
              >
                <Stamp className="w-4 h-4" />
                <span className="hidden md:inline">ลายน้ำ</span>
              </button>

              {/* Lock Room Quick Toggle */}
              <button
                onClick={() => patchSettings({ isLocked: !settings.isLocked })}
                className={`h-10 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  settings.isLocked
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
                title="ล็อกห้องไม่ให้คนใหม่เข้าเพิ่ม"
              >
                {settings.isLocked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span className="hidden lg:inline">
                  {settings.isLocked ? "ล็อกอยู่" : "เปิดรับ"}
                </span>
              </button>

              {status === RoomStatus.LIVE && (
                <>
                  <div className="h-5 w-px bg-white/[0.08] mx-1" />
                  <button
                    onClick={handleStopBroadcast}
                    className="h-10 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>หยุดแชร์</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Collapsible Inspector Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 sm:w-96 border-l border-white/[0.08] bg-zinc-950/95 flex flex-col shrink-0 z-10">
            {/* Sidebar Tabs */}
            <div className="p-2 border-b border-white/[0.08] grid grid-cols-2 gap-1 bg-zinc-900/50">
              <button
                onClick={() => setActiveTab("settings")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === "settings"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>ตั้งค่าสตรีม</span>
              </button>
              <button
                onClick={() => setActiveTab("viewers")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === "viewers"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>ผู้เข้าชม ({participants.length})</span>
              </button>
            </div>

            {/* Sidebar Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {activeTab === "settings" ? (
                <>
                  {/* Video Quality & Resolution */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                      <Tv className="w-3.5 h-3.5 text-amber-400" />
                      <span>ความละเอียดและเฟรมเรต (ปรับสดได้ทันที)</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(["720p", "1080p", "1440p", "4k"] as const).map((res) => (
                        <button
                          key={res}
                          onClick={() => patchSettings({ resolution: res })}
                          className={`py-2 rounded-lg text-xs font-mono font-semibold border transition-all ${
                            settings.resolution === res
                              ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                              : "bg-zinc-900 border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {res.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[15, 24, 30, 60].map((fps) => (
                        <button
                          key={fps}
                          onClick={() => patchSettings({ frameRate: fps })}
                          className={`py-1.5 rounded-lg text-xs font-mono border transition-all ${
                            settings.frameRate === fps
                              ? "bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold"
                              : "bg-zinc-900 border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {fps} FPS
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className="h-px bg-white/[0.06]" />

                  {/* Encoder Bitrate & Optimization Mode */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span>บิตเรตสูงสุด (Max Bitrate)</span>
                      </div>
                      <span className="text-xs font-mono text-amber-400">
                        {(settings.maxBitrateKbps / 1000).toFixed(1)} Mbps
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "1.5M", kbps: 1500 },
                        { label: "3.5M", kbps: 3500 },
                        { label: "6.0M", kbps: 6000 },
                        { label: "12M", kbps: 12000 }
                      ].map((b) => (
                        <button
                          key={b.kbps}
                          onClick={() => patchSettings({ maxBitrateKbps: b.kbps })}
                          className={`py-1.5 rounded-lg text-xs font-mono border transition-all ${
                            settings.maxBitrateKbps === b.kbps
                              ? "bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold"
                              : "bg-zinc-900 border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] text-zinc-400 block">
                        โหมดปรับภาพตามเนื้อหา (Content Hint)
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() =>
                            patchSettings({
                              contentHint: "detail",
                              degradationPreference: "maintain-resolution"
                            })
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            settings.contentHint === "detail"
                              ? "bg-amber-500/15 border-amber-500/40 text-zinc-100"
                              : "bg-zinc-900 border-white/[0.06] text-zinc-400"
                          }`}
                        >
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>ตัวอักษรคมชัด</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            เหมาะกับสไลด์ โค้ด เอกสาร
                          </p>
                        </button>

                        <button
                          onClick={() =>
                            patchSettings({
                              contentHint: "motion",
                              degradationPreference: "maintain-framerate"
                            })
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            settings.contentHint === "motion"
                              ? "bg-amber-500/15 border-amber-500/40 text-zinc-100"
                              : "bg-zinc-900 border-white/[0.06] text-zinc-400"
                          }`}
                        >
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 text-amber-400" />
                            <span>ภาพเคลื่อนไหวลื่น</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            เหมาะกับวิดีโอ แอนิเมชัน 3D
                          </p>
                        </button>
                      </div>
                    </div>
                  </section>

                  <div className="h-px bg-white/[0.06]" />

                  {/* Audio & Microphone Device */}
                  <section className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                      <Mic className="w-3.5 h-3.5 text-amber-400" />
                      <span>อุปกรณ์ไมโครโฟน</span>
                    </div>

                    {audioDevices.length > 0 ? (
                      <select
                        value={selectedMicId}
                        onChange={(e) => handleChangeMicDevice(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-white/[0.08] text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                      >
                        {audioDevices.map((d, idx) => (
                          <option key={d.deviceId || idx} value={d.deviceId}>
                            {d.label || `ไมโครโฟน #${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[11px] text-zinc-500">
                        ไม่พบไมโครโฟนแยก หรือยังไม่ได้อนุญาตสิทธิ์ไมค์
                      </p>
                    )}
                  </section>

                  <div className="h-px bg-white/[0.06]" />

                  {/* Subtle Corner Watermark Configuration */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                        <Stamp className="w-3.5 h-3.5 text-amber-400" />
                        <span>ลายน้ำมุมหน้าจอ (Watermark)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.watermark.enabled}
                        onChange={(e) =>
                          patchSettings({
                            watermark: {
                              ...settings.watermark,
                              enabled: e.target.checked
                            }
                          })
                        }
                        className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                      />
                    </div>

                    {settings.watermark.enabled && (
                      <div className="space-y-3 pl-1">
                        <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                          <span>แสดงโลโก้ในลายน้ำ</span>
                          <input
                            type="checkbox"
                            checked={settings.watermark.showLogo}
                            onChange={(e) =>
                              patchSettings({
                                watermark: {
                                  ...settings.watermark,
                                  showLogo: e.target.checked
                                }
                              })
                            }
                            className="accent-amber-500 w-3.5 h-3.5 rounded"
                          />
                        </label>

                        <div className="space-y-1">
                          <label className="text-[11px] text-zinc-400 block">
                            ข้อความกำกับมุมจอ (เว้นว่างได้หากต้องการแค่โลโก้)
                          </label>
                          <input
                            type="text"
                            value={settings.watermark.text}
                            onChange={(e) =>
                              patchSettings({
                                watermark: {
                                  ...settings.watermark,
                                  text: e.target.value
                                }
                              })
                            }
                            placeholder="เช่น ม.4/1 หรือรหัสห้อง"
                            className="w-full h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/[0.08] text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-zinc-400 block">
                            ตำแหน่งมุมจอ
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(
                              [
                                { id: "bottom-right", label: "ขวาล่าง" },
                                { id: "bottom-left", label: "ซ้ายล่าง" },
                                { id: "top-right", label: "ขวาบน" },
                                { id: "top-left", label: "ซ้ายบน" }
                              ] as const
                            ).map((pos) => (
                              <button
                                key={pos.id}
                                onClick={() =>
                                  patchSettings({
                                    watermark: {
                                      ...settings.watermark,
                                      position: pos.id
                                    }
                                  })
                                }
                                className={`py-1.5 rounded-lg text-xs border transition-all ${
                                  settings.watermark.position === pos.id
                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300 font-medium"
                                    : "bg-zinc-900 border-white/[0.06] text-zinc-400"
                                }`}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-zinc-400">
                            <span>ความโปร่งแสง</span>
                            <span className="font-mono">{settings.watermark.opacity}%</span>
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={100}
                            step={5}
                            value={settings.watermark.opacity}
                            onChange={(e) =>
                              patchSettings({
                                watermark: {
                                  ...settings.watermark,
                                  opacity: Number(e.target.value)
                                }
                              })
                            }
                            className="w-full accent-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="h-px bg-white/[0.06]" />

                  {/* Room Security & Access */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>การเข้าถึงห้องเรียน</span>
                    </div>

                    <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                      <span>ล็อกห้อง (ไม่อนุญาตคนเข้าเพิ่ม)</span>
                      <input
                        type="checkbox"
                        checked={settings.isLocked}
                        onChange={(e) => patchSettings({ isLocked: e.target.checked })}
                        className="accent-amber-500 w-4 h-4 rounded"
                      />
                    </label>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400 block">
                        รหัส PIN ก่อนเข้าห้อง (เว้นว่าง = เข้าได้ทันที)
                      </label>
                      <input
                        type="text"
                        maxLength={8}
                        value={settings.pinCode}
                        onChange={(e) => patchSettings({ pinCode: e.target.value.trim() })}
                        placeholder="ไม่ได้ตั้งรหัส PIN"
                        className="w-full h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/[0.08] text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </section>
                </>
              ) : (
                /* Viewers & Quick Invite Tab */
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/[0.07] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">สถานะสัญญาณ</span>
                      <span className="font-mono text-emerald-400">
                        {peerState === "connected"
                          ? `เชื่อมต่อแล้ว (${metrics.connectedPeers} เครื่อง)`
                          : status === RoomStatus.LIVE
                          ? "กำลังรอผู้ชมเชื่อมต่อ..."
                          : "ยังไม่ได้แชร์จอ"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 h-8 px-2.5 rounded-lg bg-zinc-950 border border-white/[0.07] text-[11px] font-mono text-zinc-400"
                      />
                      <button
                        onClick={copyShareLink}
                        className="h-8 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-1"
                      >
                        {copiedLink ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>คัดลอก</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                      <span>รายชื่อผู้เข้าชมในห้อง ({participants.length})</span>
                    </div>

                    {participants.length === 0 ? (
                      <div className="py-10 text-center rounded-xl border border-dashed border-white/[0.07] text-zinc-500 text-xs">
                        ยังไม่มีผู้ชมเข้ามาในห้อง
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {participants.map((p) => (
                          <div
                            key={p.viewerId}
                            className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/[0.06] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-zinc-200 truncate">
                                {p.displayName}
                              </p>
                              <p className="text-[10px] text-zinc-500 truncate">
                                {p.deviceHint}
                              </p>
                            </div>
                            <button
                              onClick={() => handleKickViewer(p.viewerId)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-zinc-500 hover:text-rose-400 transition-colors"
                              title="นำออกจากห้อง"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Invite / QR Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-white/10 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-100">สแกนเข้าดูหน้าจอ</h3>
                <p className="text-xs text-zinc-400">{roomName}</p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl flex justify-center mx-auto w-fit shadow-inner">
              {shareUrl && <QRCodeSVG value={shareUrl} size={200} />}
            </div>

            <div className="text-center space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400">
                รหัสเข้าห้องเรียน
              </p>
              <p className="text-3xl font-mono font-bold tracking-widest text-amber-400">
                {formatRoomCode(roomCode)}
              </p>
              {settings.pinCode && (
                <p className="text-xs text-zinc-300 pt-1">
                  รหัส PIN: <span className="font-mono font-bold">{settings.pinCode}</span>
                </p>
              )}
            </div>

            <button
              onClick={copyShareLink}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์เข้าห้อง"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
