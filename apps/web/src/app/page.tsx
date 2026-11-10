"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button, Card, Input } from "@kshare/ui";
import {
  MonitorPlay,
  ArrowRight,
  Zap,
  ShieldCheck,
  Globe2,
  Tv
} from "lucide-react";
import { toast } from "sonner";
import { formatRoomCode } from "@kshare/protocol";

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      toast.error("กรุณากรอกรหัสห้องเรียน");
      return;
    }
    const clean = roomCode.toUpperCase().replace(/\s+/g, "");
    router.push(`/room/${clean}`);
  };

  const handleQuickCreate = async () => {
    setIsCreating(true);
    const finalName = roomName.trim() || "ห้องเรียน วมว.";

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถสร้างห้องได้");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(`kshare_host_${data.room.code}`, data.hostToken);
      }

      toast.success(`สร้างห้องเรียนสำเร็จ: ${data.room.code}`);
      router.push(`/room/${data.room.code}?token=${data.hostToken}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30">
      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto max-w-4xl px-4 sm:px-6 pt-12 pb-16 text-center flex-1 flex flex-col items-center justify-center">
        {/* SCiUS Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-20 w-20 rounded-full border-2 border-primary/40 p-1 bg-black/40 shadow-xl mb-3 flex items-center justify-center scius-gold-glow">
            <Image
              src="/scius-logo.png"
              alt="ตราสัญลักษณ์ วมว."
              width={70}
              height={70}
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xs uppercase tracking-widest text-primary font-bold">
            SCiUS SCREEN SHARE • โครงการ วมว.
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.2]">
          ระบบแชร์หน้าจอห้องเรียน{" "}
          <span className="text-primary underline decoration-primary/40 decoration-wavy">
            วมว.
          </span>
        </h1>

        <p className="mt-3 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          แชร์หน้าจอ 1:1 แบบ Real-Time P2P ความหน่วงต่ำ คมชัดระดับ 60 FPS 
          ส่งตรงระหว่างเครื่องในห้องเรียน ไม่ต้องติดตั้งโปรแกรม
        </p>

        {/* Action Box */}
        <div className="mt-8 w-full max-w-2xl">
          <Card className="p-2 sm:p-3 bg-card border-primary/20 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
              {/* Host Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-background border border-border/70 text-left">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <MonitorPlay className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-foreground text-sm">
                      แชร์หน้าจอ (Host)
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    สร้างห้องแล้วเริ่มแชร์สไลด์ โค้ด หรือหน้าจอพร้อมลิงก์เชิญ
                  </p>

                  <Input
                    placeholder="เช่น ฟิสิกส์ ม.4, ติวสอบเคมี, แล็บโค้ด"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="h-10 text-xs mb-3 bg-card"
                  />
                </div>

                <Button
                  variant="default"
                  className="w-full font-semibold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-md h-10"
                  onClick={handleQuickCreate}
                  disabled={isCreating}
                >
                  <MonitorPlay className="h-4 w-4 mr-1.5" />
                  {isCreating ? "กำลังสร้างห้อง..." : "เริ่มเปิดห้องแชร์หน้าจอ"}
                </Button>
              </div>

              {/* Viewer Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-background border border-border/70 text-left">
                <form onSubmit={handleJoin} className="h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                        <Tv className="h-5 w-5" />
                      </div>
                      <span className="font-semibold text-foreground text-sm">
                        เข้ารับชม (Viewer)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      ใส่รหัสห้องเพื่อรับชมภาพหน้าจอแบบความละเอียดสูง
                    </p>
                    <Input
                      placeholder="เช่น KSH-8492"
                      value={roomCode}
                      onChange={(e) => setRoomCode(formatRoomCode(e.target.value))}
                      className="h-10 text-sm uppercase tracking-wider font-mono mb-3 bg-card border-border/80"
                      maxLength={8}
                    />
                    <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                      💡 ดูผ่านไอแพดหรือแท็บเล็ตได้ทันที ไม่จอดำ
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="cyber"
                    className="w-full font-semibold text-xs mt-3 bg-blue-600 hover:bg-blue-700 text-white h-10"
                  >
                    เข้าร่วมห้องเรียน
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>

        {/* 3 Core Highlights */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-left">
          <div className="p-4 rounded-xl bg-card border border-primary/20">
            <Zap className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-semibold text-xs text-foreground mb-1">ความคมชัด 60 FPS</h3>
            <p className="text-[11px] text-muted-foreground">อ่านสไลด์และโค้ดได้ชัดเจน ปรับความละเอียดได้ถึง 4K</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-primary/20">
            <Globe2 className="h-5 w-5 text-blue-400 mb-2" />
            <h3 className="font-semibold text-xs text-foreground mb-1">Ultra Low-Latency P2P</h3>
            <p className="text-[11px] text-muted-foreground">ภาพและเสียงส่งตรง ไม่ผ่านเซิร์ฟเวอร์กลาง ความหน่วงต่ำพิเศษ</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-primary/20">
            <ShieldCheck className="h-5 w-5 text-emerald-400 mb-2" />
            <h3 className="font-semibold text-xs text-foreground mb-1">ตั้งค่า Hosting ยืดหยุ่น</h3>
            <p className="text-[11px] text-muted-foreground">ปรับความละเอียด, FPS, เปิด/ปิดไมค์, ล็อกห้อง และลายน้ำ</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/20 py-6 bg-background">
        <div className="container mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">SCiUS Share</span>
            <span>—</span>
            <span>ห้องเรียนวิทยาศาสตร์ วมว.</span>
          </div>
          <span className="text-[11px] font-mono text-primary/80">60 FPS • P2P WebRTC</span>
        </div>
      </footer>
    </div>
  );
}
