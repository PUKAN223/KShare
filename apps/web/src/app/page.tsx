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
  Tv,
  Trash2,
  Wifi,
  RefreshCw,
  QrCode,
  X,
  Radio,
  Search
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { formatRoomCode, RoomStatus } from "@kshare/protocol";
import { useAppDispatch, useAppSelector } from "@/lib/store";
import {
  selectRooms,
  selectRoomsLoading,
  selectRoomsInitialized,
  fetchRoomsThunk,
  upsertRoom,
  removeRoom,
  RoomListItem
} from "@/lib/store/room-slice";

export default function HomePage() {
  const router = useRouter();

  // Top Bar Join & Search
  const [joinCode, setJoinCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Room Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "1440p" | "4k">("1080p");
  const [frameRate, setFrameRate] = useState<number>(60);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [enablePin, setEnablePin] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const dispatch = useAppDispatch();
  const rooms = useAppSelector(selectRooms);
  const loadingRooms = useAppSelector(selectRoomsLoading);
  const isInitialized = useAppSelector(selectRoomsInitialized);

  // Active Rooms & LAN State
  const [lanIp, setLanIp] = useState("");
  const [copiedLan, setCopiedLan] = useState(false);
  const [showLanQr, setShowLanQr] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);
  const [ownedRooms, setOwnedRooms] = useState<Record<string, string>>({});

  const fetchRooms = useCallback(() => {
    dispatch(fetchRoomsThunk());
  }, [dispatch]);

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim() || undefined,
          customCode: customCode.trim() || undefined,
          settings: {
            resolution,
            frameRate,
            maxBitrateKbps: 6000,
            contentHint: "detail",
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
        sessionStorage.setItem(`kshare_host_${data.room.code}`, data.hostToken);
      }

      // Optimistically cache room in Redux before navigating
      dispatch(
        upsertRoom({
          id: data.room.id,
          code: data.room.code,
          name: data.room.name,
          subject: data.room.subject,
          status: data.room.status || RoomStatus.IDLE,
          settings: data.room.settings,
          resolution,
          frameRate,
          activeViewersCount: 0,
          createdAt: data.room.createdAt || Date.now()
        })
      );

      setShowCreateModal(false);
      router.push(`/room/${data.room.code}?token=${data.hostToken}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (cleaned.length < 4) {
      toast.error("กรุณากรอกรหัสห้อง");
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
        dispatch(removeRoom(code));
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
    toast.success(`คัดลอกลิงก์ ${code} แล้ว`);
    setTimeout(() => setCopiedRoomCode(null), 2000);
  };

  const copyLanAddress = () => {
    const url = getBaseOrigin();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLan(true);
    toast.success(`คัดลอก ${url} แล้ว`);
    setTimeout(() => setCopiedLan(false), 2000);
  };

  const filteredRooms = rooms.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#09090b] bg-studio-grid flex flex-col text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-30 h-14 border-b border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              {/*<MonitorUp className="h-4 w-4" />*/}
              <Image alt="scius-logo" width={128} height={128} src={"/scius-logo.png"}></Image>
            </div>
            <span className="text-base font-bold tracking-tight text-white">KShare</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-6 space-y-6">
        {/* Top Action Bar: Create + Join (Meet style) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>สร้างห้อง</span>
            </button>

            <form onSubmit={handleJoinSubmit} className="flex items-center gap-2">
              <div className="relative w-44 sm:w-52">
                <Keyboard className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="รหัสห้อง"
                  value={joinCode}
                  onChange={(e) => setJoinCode(formatRoomCode(e.target.value))}
                  maxLength={8}
                  className="h-10 w-full pl-9 pr-3 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono uppercase tracking-wider text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              {joinCode.trim().length > 0 && (
                <button
                  type="submit"
                  className="h-10 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <span>เข้าร่วม</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </form>
          </div>

          {/* Search + Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-52">
              <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาห้อง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={fetchRooms}
              className="h-9 w-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="รีเฟรช"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingRooms ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Screen / Room List */}
        {filteredRooms.length === 0 ? (
          loadingRooms && !isInitialized ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 py-20 px-6 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-zinc-400">กำลังโหลดรายการห้อง...</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 py-20 px-6 text-center space-y-3">
              <Tv className="h-8 w-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-400">ยังไม่มีห้องที่เปิดอยู่</p>
            </div>
          )
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
                  className="group rounded-2xl bg-zinc-900/90 hover:bg-zinc-900 border border-white/10 hover:border-amber-500/40 overflow-hidden transition-all cursor-pointer flex flex-col"
                >
                  {/* Screen Preview Box */}
                  <div className="relative h-36 bg-zinc-950 border-b border-white/[0.06] flex items-center justify-center overflow-hidden">
                    {isLive && room.thumbnailDataUrl && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={room.thumbnailDataUrl}
                          alt={room.name}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/50" />
                      </>
                    )}

                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md ${
                          isLive
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-zinc-900/90 text-zinc-400 border border-white/10"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isLive ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                          }`}
                        />
                        {isLive ? "LIVE" : "IDLE"}
                      </span>

                      {room.hasPin && (
                        <span className="p-1 rounded-md bg-amber-500/20 text-amber-300 backdrop-blur-md">
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                    </div>

                    <span className="absolute top-3 right-3 z-10 rounded-md bg-zinc-950/80 backdrop-blur-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                      {room.resolution?.toUpperCase()} • {room.frameRate}FPS
                    </span>

                    {!(isLive && room.thumbnailDataUrl) && (
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center border ${
                          isLive
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                            : "bg-zinc-900 border-white/10 text-zinc-600"
                        }`}
                      >
                        {isLive ? <Radio className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
                      </div>
                    )}

                    <span className="absolute bottom-2.5 right-3 z-10 rounded bg-black/50 backdrop-blur-sm px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider text-amber-400">
                      {formatRoomCode(room.code)}
                    </span>
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                        {room.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400">
                        <Users className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{room.activeViewersCount} คน</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => copyRoomInvite(room.code, e)}
                        className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                        title="คัดลอกลิงก์"
                      >
                        {copiedRoomCode === room.code ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {isOwner ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/room/${room.code}?token=${ownedRooms[room.code]}`
                              );
                            }}
                            className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors"
                          >
                            จัดการ
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRoom(room.code, e)}
                            className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                            title="ปิดห้อง"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="h-8 px-3 rounded-lg bg-zinc-800 group-hover:bg-amber-500 group-hover:text-zinc-950 text-zinc-200 font-semibold text-xs inline-flex items-center gap-1 transition-colors">
                          <span>เข้าดู</span>
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">สร้างห้องใหม่</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">ชื่อห้อง</label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="เว้นว่างเป็น ห้อง [รหัส]"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="h-9 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 text-xs text-white placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">รหัสห้อง</label>
                  <input
                    type="text"
                    placeholder="สุ่มอัตโนมัติ"
                    maxLength={8}
                    value={customCode}
                    onChange={(e) => setCustomCode(formatRoomCode(e.target.value))}
                    className="h-9 w-full rounded-lg border border-white/15 bg-zinc-950 px-2.5 font-mono text-xs uppercase text-center text-white placeholder:font-sans placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">ความละเอียด</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["720p", "1080p", "1440p", "4k"] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setResolution(res)}
                        className={`py-1.5 rounded-lg text-[11px] font-mono font-semibold border cursor-pointer ${
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
                  <label className="block text-xs text-zinc-400 mb-1">FPS</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[15, 30, 60].map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        onClick={() => setFrameRate(fps)}
                        className={`py-1.5 rounded-lg text-[11px] font-mono font-semibold border cursor-pointer ${
                          frameRate === fps
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-zinc-950 border-white/10 text-zinc-400"
                        }`}
                      >
                        {fps}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-white/10 bg-zinc-950 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/scius-logo.png"
                      alt="Watermark"
                      width={18}
                      height={18}
                      className="rounded-full object-contain"
                    />
                    <span className="text-xs text-zinc-300">ลายน้ำ</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={watermarkEnabled}
                    onChange={(e) => setWatermarkEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 accent-amber-500 rounded"
                  />
                </label>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-white/10 bg-zinc-950">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePin}
                      onChange={(e) => setEnablePin(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-500 rounded"
                    />
                    <span className="text-xs text-zinc-300">PIN</span>
                  </label>
                  {enablePin && (
                    <input
                      type="text"
                      placeholder="1234"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.trim())}
                      className="w-14 h-6 px-1.5 rounded bg-zinc-900 border border-amber-500/50 text-center font-mono text-xs text-white focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-9 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="h-9 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? "กำลังสร้าง..." : "สร้างห้อง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LAN QR Modal */}
      {showLanQr && lanIp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl bg-zinc-900 border border-white/15 p-5 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">QR เข้าเว็บ</h3>
              <button
                onClick={() => setShowLanQr(false)}
                className="p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl w-fit mx-auto">
              <QRCodeSVG value={getBaseOrigin()} size={180} />
            </div>

            <p className="text-sm font-mono font-bold text-amber-400">{getBaseOrigin()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
