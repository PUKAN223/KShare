"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Badge } from "@kshare/ui";
import {
  Plus,
  Copy,
  ExternalLink,
  Trash2,
  Tv,
  MonitorPlay,
  Users,
  Clock,
  Sparkles,
  Check,
  RefreshCw,
  Activity,
  Layers,
  Radio
} from "lucide-react";
import { toast } from "sonner";
import { formatRoomCode, RoomStatus } from "@kshare/protocol";

interface RoomItem {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  activeViewersCount: number;
  createdAt: number;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCreate = searchParams?.get("create") === "true";

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(initialCreate);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (res.ok) {
        setRooms(data.rooms || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      toast.error("กรุณาระบุชื่อห้อง");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName.trim(),
          customCode: newRoomCode.trim() ? newRoomCode.trim().toUpperCase() : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถสร้างห้องได้");
      }

      // Save token locally
      if (typeof window !== "undefined") {
        localStorage.setItem(`kshare_host_${data.room.code}`, data.hostToken);
      }

      toast.success(`สร้างห้อง ${data.room.code} เรียบร้อยแล้ว`);
      setShowCreateModal(false);
      setNewRoomName("");
      setNewRoomCode("");
      fetchRooms();

      // Navigate to host studio
      router.push(`/room/${data.room.code}?token=${data.hostToken}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInviteLink = (code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/room/${code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(code);
    toast.success("คัดลอกลิงก์เชิญเรียบร้อยแล้ว");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              แดชบอร์ดจัดการห้อง
            </h1>
            <Badge variant="secondary" className="text-xs font-mono">
              {rooms.length} ห้อง
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            สร้าง จัดการ และตรวจสอบสถานะห้องแชร์หน้าจอ P2P ของคุณ
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRooms}
            className="gap-1.5 text-xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            สร้างห้องใหม่
          </Button>
        </div>
      </div>

      {/* Modal / Card to Create Room */}
      {showCreateModal && (
        <div className="my-6">
          <Card glow className="p-6 bg-card/90 border-primary/30 max-w-xl mx-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400">
                  <MonitorPlay className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">
                  สร้างห้องแชร์หน้าจอใหม่
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  ชื่อห้อง / วิชา / หัวข้อการประชุม *
                </label>
                <Input
                  placeholder="เช่น ติวการเขียนโปรแกรม Python คอร์ส 1"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  กำหนดรหัสห้องเอง (ทางเลือก เช่น KSH-MATH)
                </label>
                <Input
                  placeholder="ปล่อยว่างเพื่อสุ่มอัตโนมัติ"
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(formatRoomCode(e.target.value))}
                  className="uppercase font-mono tracking-wider"
                  maxLength={10}
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  ตัวอักษรและตัวเลข 4-10 ตัว
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="gradient"
                  size="sm"
                  disabled={isSubmitting}
                  className="font-semibold"
                >
                  {isSubmitting ? "กำลังเปิดห้อง..." : "สร้างห้องและเริ่มแชร์"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Content Section: Rooms List */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Radio className="h-4 w-4 text-orange-400" />
            ห้องที่มีอยู่ในระบบ
          </h2>
        </div>

        {loading && rooms.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm animate-pulse">
            กำลังโหลดข้อมูลห้อง...
          </div>
        ) : rooms.length === 0 ? (
          <Card className="p-12 text-center bg-card/40 border-dashed border-border/70">
            <div className="flex flex-col items-center max-w-sm mx-auto">
              <div className="h-14 w-14 rounded-2xl bg-secondary/80 flex items-center justify-center text-muted-foreground mb-4">
                <Tv className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-1">
                ยังไม่มีห้องในขณะนี้
              </h3>
              <p className="text-xs text-muted-foreground mb-5">
                เริ่มต้นด้วยการสร้างห้องแชร์หน้าจอห้องแรกของคุณ
              </p>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="font-semibold"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                สร้างห้องแชร์หน้าจอ
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => {
              const isLive = room.status === RoomStatus.ACTIVE;
              return (
                <Card
                  key={room.id}
                  glow={isLive}
                  className="p-5 bg-card/60 hover:border-primary/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <Badge
                          variant={isLive ? "live" : "secondary"}
                          dot
                          pulse={isLive}
                          className="font-mono text-xs uppercase"
                        >
                          {room.code}
                        </Badge>
                      </div>
                      <Badge
                        variant={isLive ? "live" : "outline"}
                        className="text-[11px]"
                      >
                        {isLive ? "กำลังถ่ายทอดสด" : "รอการเชื่อมต่อ"}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-foreground text-base line-clamp-1 mb-1">
                      {room.name}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {room.activeViewersCount} ผู้ชม
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(room.createdAt).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(room.code)}
                      className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                      title="คัดลอกลิงก์เชิญ"
                    >
                      {copiedCode === room.code ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 mr-1" />
                      )}
                      คัดลอกลิงก์
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/room/${room.code}/view`)}
                        className="text-xs h-8 px-2.5"
                        title="เข้าชมในฐานะผู้ชม"
                      >
                        <Tv className="h-3.5 w-3.5 mr-1" />
                        ชม
                      </Button>
                      <Button
                        variant={isLive ? "gradient" : "default"}
                        size="sm"
                        onClick={() => {
                          const savedToken =
                            typeof window !== "undefined"
                              ? localStorage.getItem(`kshare_host_${room.code}`)
                              : null;
                          router.push(
                            `/room/${room.code}${savedToken ? `?token=${savedToken}` : ""}`
                          );
                        }}
                        className="text-xs h-8 px-3 font-semibold"
                      >
                        <MonitorPlay className="h-3.5 w-3.5 mr-1" />
                        ห้องควบคุม
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30">
      <Navbar />
      <Suspense fallback={<div className="container mx-auto p-12 text-center text-sm text-muted-foreground">กำลังโหลดแดชบอร์ด...</div>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
