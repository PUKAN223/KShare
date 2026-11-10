"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button, Card, CardContent, Input, Badge } from "@kshare/ui";
import {
  MonitorPlay,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  Lock,
  Globe2,
  Tv,
  ExternalLink,
  ChevronRight
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
      toast.error("กรุณากรอกรหัสห้อง เช่น KSH-1234");
      return;
    }
    const clean = roomCode.toUpperCase().replace(/\s+/g, "");
    router.push(`/room/${clean}`);
  };

  const handleQuickCreate = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim() || "ห้องแชร์หน้าจอของฉัน"
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถสร้างห้องได้");
      }

      // Save host token to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(`kshare_host_${data.room.code}`, data.hostToken);
      }

      toast.success(`สร้างห้องสำเร็จ: ${data.room.code}`);
      router.push(`/room/${data.room.code}?token=${data.hostToken}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-x-hidden selection:bg-primary/30">
      <Navbar />

      {/* Ambient background glows */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 -z-10 h-[500px] w-[800px] max-w-full bg-gradient-to-tr from-amber-500/10 via-orange-500/15 to-rose-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[600px] right-[-100px] -z-10 h-[400px] w-[500px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero Section */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28 flex flex-col items-center text-center">
        {/* Modern Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium text-amber-300 mb-6 backdrop-blur-md shadow-sm shadow-primary/20 animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          <span>V1.0 P2P WebRTC Engine with VDO.Ninja Adapter</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.15]">
          แชร์หน้าจอ 1:1 แบบ{" "}
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            Real-Time P2P
          </span>
          <br />
          ความคมชัดสูง ไม่หน่วง ปลอดภัย
        </h1>

        <p className="mt-6 text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl leading-relaxed">
          แพลตฟอร์มแชร์หน้าจอสำหรับสอนออนไลน์และการทำงานระยะไกล เชื่อมต่อแบบ Peer-to-Peer 
          โดยตรงระหว่างผู้ใช้ผ่าน WebRTC พร้อมระบบสำรองสัญญาณ TURN Relay ทันทีเมื่อเน็ตเวิร์กจำกัด
        </p>

        {/* Quick Launch & Join Box */}
        <div className="mt-10 w-full max-w-2xl">
          <Card glow className="p-2 sm:p-3 bg-card/70 border-border/80 shadow-2xl backdrop-blur-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
              {/* Box 1: Start Instant Share */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-background/60 border border-white/5 hover:border-primary/30 transition-all text-left">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400">
                      <Radio className="h-5 w-5 animate-pulse" />
                    </div>
                    <span className="font-semibold text-foreground text-base">
                      แชร์หน้าจอทันที (Host)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    สร้างห้องแบบด่วนแล้วเริ่มแชร์หน้าจอได้ใน 1 คลิก พร้อมลิงก์เชิญผู้ชม
                  </p>
                  <Input
                    placeholder="ตั้งชื่อห้อง (ทางเลือก)"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="h-9 text-xs mb-3 bg-card"
                  />
                </div>
                <Button
                  variant="gradient"
                  className="w-full font-semibold text-sm shadow-md"
                  onClick={handleQuickCreate}
                  disabled={isCreating}
                >
                  <MonitorPlay className="h-4 w-4 mr-1.5" />
                  {isCreating ? "กำลังสร้างห้อง..." : "เริ่มเปิดห้องแชร์หน้าจอ"}
                </Button>
              </div>

              {/* Box 2: Join with Code */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-background/60 border border-white/5 hover:border-cyan-500/30 transition-all text-left">
                <form onSubmit={handleJoin} className="h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400">
                        <Tv className="h-5 w-5" />
                      </div>
                      <span className="font-semibold text-foreground text-base">
                        เข้ารับชม (Viewer)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      ใส่รหัสห้อง 6-8 หลักเพื่อเข้าร่วมชมภาพหน้าจอแบบความละเอียดสูง
                    </p>
                    <Input
                      placeholder="เช่น KSH-8492"
                      value={roomCode}
                      onChange={(e) => setRoomCode(formatRoomCode(e.target.value))}
                      className="h-9 text-xs uppercase tracking-wider font-mono mb-3 bg-card"
                      maxLength={8}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="cyber"
                    className="w-full font-semibold text-sm"
                  >
                    เข้าร่วมห้อง
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>

        {/* Key Highlights Banner */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>ไม่ต้องติดตั้งโปรแกรม (Web Browser 100%)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>ส่งข้อมูลผ่าน P2P โดยตรง ไม่กินแบนด์วิดท์เซิร์ฟเวอร์</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>ความละเอียดสูงสุด 1080p / 4K 60FPS</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>เข้ารหัส WebRTC DTLS-SRTP ปลอดภัย</span>
          </div>
        </div>
      </section>

      {/* Feature Grid Section (Fastory / Ruffblitz modern layout) */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-16 border-t border-border/40">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-3 px-3 py-1 text-xs">
            Core Architecture
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            ออกแบบโครงสร้างเพื่อความเร็ว ความยืดหยุ่น และความเสถียร
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
            สร้างขึ้นด้วย Adapter Architecture เพื่อให้สามารถเปลี่ยนหรือต่อขยาย Engine ได้ในอนาคต
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <Card glow className="p-6 bg-card/60">
            <div className="h-12 w-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-5">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              Ultra Low Latency P2P
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              ภาพหน้าจอและเสียงจะถูกส่งโดยตรงระหว่างอุปกรณ์ของผู้สอนและผู้เรียนผ่าน WebRTC P2P
              ให้ความหน่วงต่ำระดับมิลลิวินาที ไม่กระตุก ตอบสนองทันที
            </p>
          </Card>

          {/* Card 2 */}
          <Card glow className="p-6 bg-card/60">
            <div className="h-12 w-12 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center mb-5">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              Adapter Architecture
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              แยก Business Logic และ UI ออกจาก Media Engine อย่างเด็ดขาด V1 ขับเคลื่อนด้วย VDO.Ninja SDK
              และพร้อมต่อยอดไปยัง Native WebRTC หรือ SFU (LiveKit) ในอนาคต
            </p>
          </Card>

          {/* Card 3 */}
          <Card glow className="p-6 bg-card/60">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-5">
              <Globe2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              Smart TURN Relay Fallback
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              หมดกังวลเรื่องไฟร์วอลล์องค์กรหรือเครือข่าย Symmetric NAT 
              ด้วยระบบ ICE Candidate อัจฉริยะที่สลับไปใช้ TURN Relay ทันทีเพื่อให้ภาพไม่ขาดหาย
            </p>
          </Card>
        </div>
      </section>

      {/* Live System Diagnostics Quick Bar */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 mb-12">
        <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-card/80 via-background to-card/80 p-6 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-left">
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-base">
                ตรวจสอบความพร้อมของเบราว์เซอร์ของคุณ
              </h4>
              <p className="text-xs text-muted-foreground">
                ทดสอบการรองรับ Screen Capture API, WebRTC DataChannel และ STUN/TURN latency
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/system-check")}
            className="whitespace-nowrap text-xs font-semibold"
          >
            เปิดเครื่องมือทดสอบระบบ
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/40 py-8 bg-background/80">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">KShare</span>
            <span>—</span>
            <span>A lightweight, peer-to-peer screen sharing platform</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-muted-foreground/80">
              Next.js • TypeScript • Tailwind CSS • WebRTC
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
