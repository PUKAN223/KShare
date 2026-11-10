"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MonitorUp,
  Plus,
  Keyboard,
  ArrowRight,
  Copy,
  Check,
  Users,
  Lock,
  Sparkles,
  Sliders,
  Tv,
  Trash2,
  Wifi,
  RefreshCw,
  Play,
  QrCode,
  X,
  Radio,
  Search,
  Zap
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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

export default function MeetStyleHomePage() {
  const router = useRouter();

  // Top Bar Join Input (Google Meet style)
  const [joinCode, setJoinCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("ทั้งหมด");

  // Create Room Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [subject, setSubject] = useState("ทั่วไป");
  const [customCode, setCustomCode] = useState("");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "1440p" | "4k">("1080p");
  const [frameRate, setFrameRate] = useState<number>(60);
  const [maxBitrateKbps, setMaxBitrateKbps] = useState<number>(6000);
  const [contentHint, setContentHint] = useState<"detail" | "motion">("detail");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [enablePin, setEnablePin] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Active Rooms List & LAN State
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [lanIp, setLanIp] = useState("");
  const [copiedLan, setCopiedLan] = useState(false);
  const [showLanQr, setShowLanQr] = useState(false);
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
    const timer = setInterval(fetchRooms, 3000);

    fetch("/api/network-ip")
      .then((r) => r.json())
      .then((d) => {
        if (d.ip && d.ip !== "localhost") setLanIp(d.ip);
      })
      .catch(() => {});

    if (typeof window !== "undefined") {
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

  // Instant 1-Click Room Creation or Configured Creation
  const createRoomNow = async (quick = false) => {
    setIsCreating(true);
    const finalTitle = quick
      ? "ห้องแชร์หน้าจอ"
      : roomName.trim() || (subject !== "ทั่วไป" ? `วิชา${subject}` : "ห้องแชร์หน้าจอ");

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalTitle,
          subject: quick ? "ทั่วไป" : subject,
          customCode: !quick && customCode.trim() ? customCode.trim() : undefined,
          settings: {
            resolution: quick ? "1080p" : resolution,
            frameRate: quick ? 60 : frameRate,
            maxBitrateKbps: quick ? 6000 : maxBitrateKbps,
            contentHint: quick ? "detail" : contentHint,
            pinCode: !quick && enablePin ? pinCode.trim() : "",
            watermark: {
              enabled: quick ? true : watermarkEnabled,
              showLogo: true,
              text: !quick && customCode.trim() ? customCode.trim() : "",
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
        sessionStorage.setItem(`kshare_host_${data.room.code}`, data.hostToken);
      }

      setShowCreateModal(false);
      router.push(`/room/${data.room.code}?token=${data.hostToken}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRoomNow(false);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (cleaned.length < 4) {
      toast.error("กรุณากรอกรหัสห้อง เช่น KSH-1234");
      return;
    }
    router.push(`/room/${formatRoomCode(cleaned)}`);
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
        toast.info(`ปิดห้อง ${code} เรียบร้อย`);
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
    toast.success(`คัดลอก ${url} สำหรับเปิดบน iPad แล้ว`);
    setTimeout(() => setCopiedLan(false), 2000);
  };

  // Filtered rooms for the main list
  const filteredRooms = rooms.filter((r) => {
    const matchesSubject =
      selectedSubjectFilter === "ทั้งหมด" || r.subject === selectedSubjectFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      (r.subject || "").toLowerCase().includes(q);
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#09090b] bg-studio-grid flex flex-col text-zinc-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 h-15 border-b border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <MonitorUp className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight text-white">KShare</span>
              <span className="hidden sm:inline-block text-xs text-zinc-400">
                ระบบแชร์หน้าจอห้องเรียน
              </span>
            </div>
          </div>

          {/* Right LAN URL & QR Button for iPad */}
          <div className="flex items-center gap-2">
            {lanIp && (
              <>
                <button
                  type="button"
                  onClick={copyLanAddress}
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-3 py-1.5 text-xs transition-colors cursor-pointer"
                  title="คลิกเพื่อคัดลอก URL สำหรับเปิดบน iPad"
                >
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-zinc-400 hidden md:inline">iPad เข้าที่:</span>
                  <span className="font-mono font-semibold text-amber-300">
                    {lanIp}:3000
                  </span>
                  {copiedLan ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLanQr(true)}
                  className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <QrCode className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">QR</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-6 space-y-6">
        {/* TOP BAR: Google Meet-style Create & Join Action Bar */}
        <section className="rounded-2xl bg-zinc-900/90 border border-white/10 p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Create Screen Share Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-zinc-950 font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>สร้างห้องแชร์หน้าจอ</span>
              </button>

              <button
                type="button"
                disabled={isCreating}
                onClick={() => createRoomNow(true)}
                className="h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10 font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                title="เปิดห้องแชร์หน้าจอทันทีในคลิกเดียวด้วยค่าเริ่มต้น 1080p 60FPS"
              >
                <Zap className="h-4 w-4 text-amber-400" />
                <span>แชร์ด่วนทันที</span>
              </button>
            </div>

            {/* Right: Inline Join with Code (Google Meet style) */}
            <form
              onSubmit={handleJoinSubmit}
              className="flex items-center gap-2 w-full lg:w-auto"
            >
              <div className="relative flex-1 lg:w-64">
                <Keyboard className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="กรอกรหัสห้อง (เช่น KSH-1234)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(formatRoomCode(e.target.value))}
                  maxLength={8}
                  className="h-11 w-full pl-10 pr-3.5 rounded-xl bg-zinc-950 border border-white/15 text-sm font-mono uppercase tracking-wider text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={joinCode.trim().length < 4}
                className="h-11 px-5 rounded-xl bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 disabled:opacity-40 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 text-amber-400 font-bold text-sm inline-flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <span>เข้าร่วม</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        {/* MAIN SECTION: Active Screen List Directory */}
        <section className="space-y-4">
          {/* List Header + Subject Filter + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tv className="h-4 w-4 text-amber-400" />
                <span>หน้าจอที่เปิดอยู่ในขณะนี้</span>
              </h2>
              <span className="rounded-full bg-zinc-800 border border-white/10 px-2.5 py-0.5 font-mono text-xs text-zinc-300">
                {filteredRooms.length} ห้อง
              </span>
              <button
                type="button"
                onClick={fetchRooms}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="รีเฟรชรายการหน้าจอ"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingRooms ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Search & Subject Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อห้อง หรือรหัส..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-44 sm:w-52 pl-8 pr-3 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto">
                {["ทั้งหมด", ...SUBJECT_TAGS].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedSubjectFilter(tag)}
                    className={`h-8 px-2.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                      selectedSubjectFilter === tag
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-white/[0.06]"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Screen List Cards Grid */}
          {filteredRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/40 py-16 px-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-white/10 text-zinc-400">
                <MonitorUp className="h-7 w-7 text-amber-400/80" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-zinc-200">
                  ยังไม่มีหน้าจอที่กำลังแชร์ในขณะนี้
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  เมื่อมีผู้สอนหรือเพื่อนเปิดห้องแชร์หน้าจอ รายการหน้าจอจะปรากฏที่นี่โดยอัตโนมัติเพื่อให้กดเข้าดูได้ในคลิกเดียว
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>เปิดห้องแชร์หน้าจอแรกเลย</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => {
                const isLive =
                  room.status === RoomStatus.ACTIVE || room.status === RoomStatus.LIVE;
                const isOwner = Boolean(ownedRooms[room.code]);

                return (
                  <div
                    key={room.id}
                    onClick={() => router.push(`/room/${room.code}`)}
                    className="group rounded-2xl bg-zinc-900/90 hover:bg-zinc-900 border border-white/10 hover:border-amber-500/50 overflow-hidden transition-all cursor-pointer flex flex-col shadow-lg"
                  >
                    {/* Visual Screen Thumbnail Preview Header */}
                    <div className="relative h-36 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border-b border-white/[0.07] flex flex-col items-center justify-center p-4">
                      {/* Top-left Status Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                            isLive
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-zinc-800/90 text-zinc-400 border border-white/10"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isLive ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                            }`}
                          />
                          {isLive ? "LIVE กำลังแชร์จอ" : "รอเริ่มแชร์"}
                        </span>

                        {room.hasPin && (
                          <span
                            className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300"
                            title="ต้องใช้รหัส PIN"
                          >
                            <Lock className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      {/* Top-right Quality Badge */}
                      <span className="absolute top-3 right-3 rounded-lg bg-zinc-950/80 border border-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                        {room.resolution?.toUpperCase()} • {room.frameRate}FPS
                      </span>

                      {/* Center Screen Icon */}
                      <div
                        className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 ${
                          isLive
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                            : "bg-zinc-800/70 border-white/10 text-zinc-500"
                        }`}
                      >
                        {isLive ? (
                          <Radio className="h-6 w-6" />
                        ) : (
                          <Tv className="h-6 w-6" />
                        )}
                      </div>

                      {/* Bottom-left Subject & Code */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                        <span className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                          {room.subject || "ทั่วไป"}
                        </span>
                        <span className="font-mono text-xs font-bold tracking-wider text-amber-400">
                          {formatRoomCode(room.code)}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                          {room.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-amber-400" />
                            <span>คนดู {room.activeViewersCount} คน</span>
                          </span>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={(e) => copyRoomInvite(room.code, e)}
                          className="h-9 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                          title="คัดลอกลิงก์ห้อง"
                        >
                          {copiedRoomCode === room.code ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>คัดลอกลิงก์</span>
                        </button>

                        {isOwner ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/room/${room.code}?token=${ownedRooms[room.code]}`
                                );
                              }}
                              className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors"
                            >
                              จัดการสตูดิโอ
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRoom(room.code, e)}
                              className="h-9 w-9 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                              title="ปิดห้อง"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="h-9 px-4 rounded-xl bg-amber-500 group-hover:bg-amber-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors">
                            <span>เข้าดูหน้าจอ</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL 1: Create Screen Share Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/15 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <MonitorUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">สร้างห้องแชร์หน้าจอ</h3>
                  <p className="text-xs text-zinc-400">
                    ตั้งชื่อห้องและเลือกความละเอียดก่อนเริ่มแชร์
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    ชื่อห้องเรียน / หัวข้อ (เว้นว่างได้)
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="เช่น ฟิสิกส์ ม.4/1, สไลด์บทที่ 3"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/15 bg-zinc-950 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    รหัสห้อง (ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    placeholder="สุ่มอัตโนมัติ"
                    maxLength={8}
                    value={customCode}
                    onChange={(e) => setCustomCode(formatRoomCode(e.target.value))}
                    className="h-10 w-full rounded-xl border border-white/15 bg-zinc-950 px-3 font-mono text-xs uppercase text-center text-white placeholder:font-sans placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Subject Chips */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  หมวดวิชา
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECT_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSubject(tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        subject === tag
                          ? "bg-amber-500 text-zinc-950 font-bold"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality & FPS */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">
                    ความละเอียดภาพ
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["720p", "1080p", "1440p", "4k"] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setResolution(res)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                          resolution === res
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-zinc-950 border-white/10 text-zinc-400"
                        }`}
                      >
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">
                    เฟรมเรต (FPS)
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[15, 30, 60].map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        onClick={() => setFrameRate(fps)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                          frameRate === fps
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-zinc-950 border-white/10 text-zinc-400"
                        }`}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content Optimization & Watermark & PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-zinc-950/70 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Image
                      src="/scius-logo.png"
                      alt="Watermark"
                      width={22}
                      height={22}
                      className="rounded-full object-contain"
                    />
                    <span className="text-xs font-medium text-zinc-200">
                      แสดงลายน้ำโลโก้มุมจอ
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={watermarkEnabled}
                    onChange={(e) => setWatermarkEnabled(e.target.checked)}
                    className="h-4 w-4 accent-amber-500 rounded"
                  />
                </label>

                <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-zinc-950/70">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePin}
                      onChange={(e) => setEnablePin(e.target.checked)}
                      className="h-4 w-4 accent-amber-500 rounded"
                    />
                    <span className="text-xs font-medium text-zinc-200">ตั้งรหัส PIN</span>
                  </label>
                  {enablePin && (
                    <input
                      type="text"
                      placeholder="PIN"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.trim())}
                      className="w-16 h-7 px-2 rounded bg-zinc-900 border border-amber-500/50 text-center font-mono text-xs text-white focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="h-10 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  <MonitorUp className="h-4 w-4" />
                  <span>{isCreating ? "กำลังสร้างห้อง..." : "สร้างห้องและเริ่มแชร์"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LAN QR Code Modal */}
      {showLanQr && lanIp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl space-y-5 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">สแกนเพื่อเปิดเว็บใน iPad</h3>
              <button
                onClick={() => setShowLanQr(false)}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl w-fit mx-auto shadow-inner">
              <QRCodeSVG value={getBaseOrigin()} size={200} />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-zinc-400">หรือพิมพ์ URL นี้ใน Safari บน iPad:</p>
              <p className="text-lg font-mono font-bold text-amber-400">{getBaseOrigin()}</p>
            </div>

            <button
              onClick={copyLanAddress}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2"
            >
              {copiedLan ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedLan ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
