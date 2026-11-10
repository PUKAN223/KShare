"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MonitorUp,
  MonitorPlay,
  ArrowRight,
  Copy,
  Check,
  Users,
  Lock,
  Sparkles,
  Sliders,
  Tv,
  Trash2,
  RefreshCw,
  Wifi,
  Shield,
  Zap,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { formatRoomCode, RoomStatus } from "@kshare/protocol";

interface RoomListItem {
  id: string;
  code: string;
  name: string;
  subject: string;
  status: RoomStatus;
  isLocked: boolean;
  hasPin: boolean;
  resolution: string;
  frameRate: number;
  activeViewersCount: number;
  createdAt: number;
}

const SUBJECT_TAGS = ["ทั่วไป", "ฟิสิกส์", "เคมี", "ชีววิทยา", "คณิตศาสตร์", "คอมพิวเตอร์"];

export default function WorkspacePage() {
  const router = useRouter();

  // Host Pre-Flight State
  const [roomName, setRoomName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [subject, setSubject] = useState("ทั่วไป");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "1440p" | "4k">("1080p");
  const [frameRate, setFrameRate] = useState<number>(60);
  const [maxBitrateKbps, setMaxBitrateKbps] = useState<number>(6000);
  const [contentHint, setContentHint] = useState<"detail" | "motion">("detail");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [enablePin, setEnablePin] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Viewer Join State
  const [joinCode, setJoinCode] = useState("");
  const [viewerName, setViewerName] = useState("");

  // Active Rooms & LAN State
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [lanIp, setLanIp] = useState("");
  const [copiedLan, setCopiedLan] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);
  const [ownedRooms, setOwnedRooms] = useState<Record<string, string>>({});

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 4000);

    fetch("/api/network-ip")
      .then((r) => r.json())
      .then((d) => {
        if (d.ip && d.ip !== "localhost") setLanIp(d.ip);
      })
      .catch(() => {});

    // Load saved host tokens & viewer name
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("kshare_viewer_name");
      if (savedName) setViewerName(savedName);

      const map: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("kshare_host_")) {
          const code = key.replace("kshare_host_", "");
          const val = localStorage.getItem(key);
          if (val) map[code] = val;
        }
      }
      setOwnedRooms(map);
    }

    return () => clearInterval(timer);
  }, [fetchRooms]);

  const getBaseOrigin = () => {
    if (typeof window === "undefined") return "";
    const port = window.location.port ? `:${window.location.port}` : "";
    const protocol = window.location.protocol;
    if (
      lanIp &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ) {
      return `${protocol}//${lanIp}${port}`;
    }
    return window.location.origin;
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    const finalTitle =
      roomName.trim() || (subject !== "ทั่วไป" ? `ห้องเรียน${subject}` : "ห้องแชร์หน้าจอ");

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalTitle,
          subject,
          customCode: customCode.trim() || undefined,
          settings: {
            resolution,
            frameRate,
            maxBitrateKbps,
            contentHint,
            pinCode: enablePin ? pinCode.trim() : "",
            watermark: {
              enabled: watermarkEnabled,
              showLogo: true,
              text: customCode.trim() || "",
              position: "bottom-right",
              opacity: 75
            }
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถสร้างห้องได้");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(`kshare_host_${data.room.code}`, data.hostToken);
      }

      toast.success(`เปิดห้อง ${data.room.code} เรียบร้อย`);
      router.push(`/room/${data.room.code}?token=${data.hostToken}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.toUpperCase().replace(/\s+/g, "");
    if (cleaned.length < 4) {
      toast.error("กรุณากรอกรหัสห้องให้ถูกต้อง");
      return;
    }
    if (typeof window !== "undefined" && viewerName.trim()) {
      localStorage.setItem("kshare_viewer_name", viewerName.trim());
    }
    router.push(`/room/${cleaned}`);
  };

  const handleDeleteRoom = async (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = ownedRooms[code];
    if (!token) return;
    try {
      const res = await fetch(`/api/rooms/${code}?token=${encodeURIComponent(token)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        localStorage.removeItem(`kshare_host_${code}`);
        toast.info(`ปิดห้อง ${code} แล้ว`);
        fetchRooms();
      }
    } catch {
      // ignore
    }
  };

  const copyRoomInvite = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${getBaseOrigin()}/room/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedRoomCode(code);
    toast.success(`คัดลอกลิงก์ห้อง ${code} แล้ว`);
    setTimeout(() => setCopiedRoomCode(null), 2000);
  };

  const copyLanAddress = () => {
    const url = getBaseOrigin();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLan(true);
    toast.success(`คัดลอก ${url} สำหรับเปิดบน iPad / อุปกรณ์ในวงแลนแล้ว`);
    setTimeout(() => setCopiedLan(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background bg-studio-grid flex flex-col text-foreground selection:bg-primary/30">
      {/* Subtle Top Radial Spotlight */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/[0.05] via-transparent to-transparent" />

      {/* Top Studio Header */}
      <header className="sticky top-0 z-40 h-14 border-b border-white/[0.07] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary shadow-inner">
              <MonitorUp className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">KShare</span>
              <span className="rounded-md bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                P2P Studio
              </span>
            </div>
          </div>

          {/* Right Status & LAN Bar */}
          <div className="flex items-center gap-2.5">
            {lanIp && (
              <button
                type="button"
                onClick={copyLanAddress}
                className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2.5 py-1 text-xs transition-colors"
                title="คลิกเพื่อคัดลอก URL สำหรับเปิดใน iPad หรืออุปกรณ์ใน Wi-Fi เดียวกัน"
              >
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline text-muted-foreground text-[11px]">LAN:</span>
                <span className="font-mono text-[11px] font-medium text-neutral-200">
                  {lanIp}:3000
                </span>
                {copiedLan ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )}

            <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              WebRTC Direct
            </div>
          </div>
        </div>
      </header>

      {/* Main Bento Console */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (7 Cols): Host Broadcast Studio Configurator */}
          <div className="lg:col-span-7 surface-panel rounded-2xl border border-white/[0.08] overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/25">
                  <MonitorPlay className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-white leading-none">
                    เปิดห้องแชร์หน้าจอ (Host Studio)
                  </h1>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    กำหนดค่าความละเอียดและสร้างห้องสำหรับส่งภาพหน้าจอแบบ Peer-to-Peer
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-primary">
                HOST MODE
              </span>
            </div>

            <form onSubmit={handleCreateRoom} className="p-5 space-y-5">
              {/* Row 1: Room Name & Custom Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    ชื่อห้อง / หัวข้อที่แชร์
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ฟิสิกส์ ม.4, ติวแคลคูลัส, เขียนโค้ด Python"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/[0.1] surface-inset px-3.5 text-xs text-white placeholder:text-neutral-500 focus:border-primary/60 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    รหัสห้อง (ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    placeholder="สุ่มอัตโนมัติ (KSH-XXXX)"
                    value={customCode}
                    onChange={(e) => setCustomCode(formatRoomCode(e.target.value))}
                    maxLength={8}
                    className="h-10 w-full rounded-xl border border-white/[0.1] surface-inset px-3 text-xs font-mono uppercase tracking-wider text-white placeholder:text-neutral-500 focus:border-primary/60 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Subject Tag Chips */}
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-2">
                  หมวดหมู่วิชา
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECT_TAGS.map((tag) => {
                    const active = subject === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSubject(tag)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                            : "bg-white/[0.04] text-neutral-400 border border-white/[0.07] hover:text-white hover:bg-white/[0.08]"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/[0.06] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-primary" />
                    ตั้งค่าคุณภาพสตรีมเริ่มต้น (Pre-Flight Encoder)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    สามารถเปลี่ยนระหว่างแชร์สดได้ตลอดเวลา
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Resolution */}
                  <div className="rounded-xl surface-inset border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        ความละเอียดภาพ (Resolution)
                      </span>
                      <span className="font-mono text-[10px] text-primary font-semibold uppercase">
                        {resolution}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["720p", "1080p", "1440p", "4k"] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setResolution(res)}
                          className={`py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                            resolution === res
                              ? "bg-white/15 text-white border border-white/20 shadow-sm"
                              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                          }`}
                        >
                          {res.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frame Rate */}
                  <div className="rounded-xl surface-inset border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        อัตรากะพริบภาพ (Frame Rate)
                      </span>
                      <span className="font-mono text-[10px] text-primary font-semibold">
                        {frameRate} FPS
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { fps: 15, label: "15 FPS" },
                        { fps: 30, label: "30 FPS" },
                        { fps: 60, label: "60 FPS" }
                      ].map((item) => (
                        <button
                          key={item.fps}
                          type="button"
                          onClick={() => setFrameRate(item.fps)}
                          className={`py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                            frameRate === item.fps
                              ? "bg-white/15 text-white border border-white/20 shadow-sm"
                              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bitrate Preset */}
                  <div className="rounded-xl surface-inset border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        บิตเรตสูงสุด (Max Bitrate)
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                        {(maxBitrateKbps / 1000).toFixed(1)} Mbps
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { kbps: 2500, label: "2.5 Mbps" },
                        { kbps: 6000, label: "6.0 Mbps" },
                        { kbps: 12000, label: "12 Mbps" }
                      ].map((b) => (
                        <button
                          key={b.kbps}
                          type="button"
                          onClick={() => setMaxBitrateKbps(b.kbps)}
                          className={`py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                            maxBitrateKbps === b.kbps
                              ? "bg-white/15 text-white border border-white/20 shadow-sm"
                              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content Optimization */}
                  <div className="rounded-xl surface-inset border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        โหมดความคมชัด (Content Hint)
                      </span>
                      <span className="font-mono text-[10px] text-neutral-300">
                        {contentHint === "detail" ? "Text/Slide" : "Video"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setContentHint("detail")}
                        className={`py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          contentHint === "detail"
                            ? "bg-white/15 text-white border border-white/20 shadow-sm"
                            : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                        }`}
                      >
                        ตัวอักษร/สไลด์คมชัด
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentHint("motion")}
                        className={`py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          contentHint === "motion"
                            ? "bg-white/15 text-white border border-white/20 shadow-sm"
                            : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                        }`}
                      >
                        วิดีโอลื่นไหล
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Watermark & PIN Security Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                  className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    watermarkEnabled
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-white/[0.07] bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full overflow-hidden border border-white/15 bg-black/40 flex items-center justify-center shrink-0">
                      <Image
                        src="/scius-logo.png"
                        alt="Watermark"
                        width={22}
                        height={22}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">แสดงลายน้ำโลโก้มุมจอ</div>
                      <div className="text-[10px] text-muted-foreground">
                        แสดงโลโก้ขนาดเล็กที่มุมจอขณะแชร์
                      </div>
                    </div>
                  </div>
                  <div
                    className={`h-4 w-4 rounded flex items-center justify-center border ${
                      watermarkEnabled
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-neutral-600"
                    }`}
                  >
                    {watermarkEnabled && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </button>

                <div
                  className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                    enablePin
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-white/[0.07] bg-white/[0.02]"
                  }`}
                >
                  <div
                    className="flex items-center gap-2.5 cursor-pointer flex-1"
                    onClick={() => setEnablePin(!enablePin)}
                  >
                    <div className="h-7 w-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-neutral-300 shrink-0">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">ล็อกรหัส PIN เข้าห้อง</div>
                      <div className="text-[10px] text-muted-foreground">
                        ต้องกรอก PIN ก่อนดูหน้าจอ
                      </div>
                    </div>
                  </div>
                  {enablePin ? (
                    <input
                      type="text"
                      placeholder="PIN 4 หลัก"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/[^0-9a-zA-Z]/g, "").slice(0, 6))}
                      className="w-20 h-7 rounded-lg border border-primary/50 bg-black/60 px-2 text-center font-mono text-xs text-white focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEnablePin(true)}
                      className="text-[11px] font-medium text-neutral-400 hover:text-white px-2 py-1 rounded bg-white/[0.05] cursor-pointer"
                    >
                      ตั้งรหัส
                    </button>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreating}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-semibold text-xs sm:text-sm shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <MonitorPlay className="h-4 w-4" />
                <span>{isCreating ? "กำลังสร้างห้อง..." : "สร้างห้องและเปิดสตูดิโอแชร์หน้าจอ"}</span>
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN (5 Cols): Viewer Quick Join + Live Active Rooms */}
          <div className="lg:col-span-5 space-y-6">
            {/* Card 1: Viewer Quick Join */}
            <div className="surface-panel rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5 bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                    <Tv className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="text-sm font-bold text-white">เข้าร่วมดูหน้าจอ (Viewer / iPad)</h2>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  ZERO-INSTALL
                </span>
              </div>

              <form onSubmit={handleJoinRoom} className="p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      รหัสห้อง *
                    </label>
                    <input
                      type="text"
                      placeholder="KSH-8492"
                      value={joinCode}
                      onChange={(e) => setJoinCode(formatRoomCode(e.target.value))}
                      maxLength={8}
                      className="h-10 w-full rounded-xl border border-white/[0.12] surface-inset px-3 font-mono text-sm font-bold uppercase tracking-widest text-white placeholder:text-neutral-600 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      ชื่อผู้เข้าชม (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น โต๊ะ 3, iPad"
                      value={viewerName}
                      onChange={(e) => setViewerName(e.target.value)}
                      maxLength={25}
                      className="h-10 w-full rounded-xl border border-white/[0.1] surface-inset px-3 text-xs text-white placeholder:text-neutral-600 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.13] border border-white/[0.12] text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>เข้าร่วมดูหน้าจอ</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>

            {/* Card 2: Live Active Rooms Directory */}
            <div className="surface-panel rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5 bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-sm font-bold text-white">ห้องที่เปิดอยู่ในขณะนี้</h2>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                    {rooms.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchRooms}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="รีเฟรชรายการห้อง"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingRooms ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="p-3 max-h-[340px] overflow-y-auto space-y-2">
                {rooms.length === 0 ? (
                  <div className="py-10 px-4 text-center">
                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-neutral-500">
                      <Layers className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-medium text-neutral-400">
                      ยังไม่มีห้องที่เปิดอยู่ตอนนี้
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      เมื่อเปิดห้องด้านซ้าย รายการห้องจะแสดงที่นี่เพื่อให้กดเข้าดูได้ในคลิกเดียว
                    </p>
                  </div>
                ) : (
                  rooms.map((room) => {
                    const isLive =
                      room.status === RoomStatus.ACTIVE || room.status === RoomStatus.LIVE;
                    const isOwner = Boolean(ownedRooms[room.code]);

                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          if (viewerName.trim() && typeof window !== "undefined") {
                            localStorage.setItem("kshare_viewer_name", viewerName.trim());
                          }
                          router.push(`/room/${room.code}`);
                        }}
                        className="group rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] p-3 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                  isLive
                                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                    : "bg-white/[0.06] text-neutral-300"
                                }`}
                              >
                                {isLive && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                )}
                                {room.code}
                              </span>

                              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-neutral-400">
                                {room.subject || "ทั่วไป"}
                              </span>

                              <span className="font-mono text-[10px] text-neutral-500">
                                {room.resolution?.toUpperCase()} • {room.frameRate}fps
                              </span>

                              {room.hasPin && (
                                <span title="มีรหัส PIN">
                                  <Lock className="h-3 w-3 text-amber-400" />
                                </span>
                              )}
                            </div>

                            <h3 className="text-xs font-semibold text-white truncate mt-1.5">
                              {room.name}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 font-mono text-[10px] text-neutral-400">
                              <Users className="h-3 w-3 text-primary" />
                              {room.activeViewersCount}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => copyRoomInvite(room.code, e)}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
                              title="คัดลอกลิงก์"
                            >
                              {copiedRoomCode === room.code ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {isOwner && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(
                                      `/room/${room.code}?token=${ownedRooms[room.code]}`
                                    );
                                  }}
                                  className="px-2 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary font-semibold text-[10px] transition-colors"
                                >
                                  สตูดิโอ
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteRoom(room.code, e)}
                                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 transition-colors"
                                  title="ปิดห้อง"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
