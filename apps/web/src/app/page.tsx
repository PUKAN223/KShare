"use client";

import React, { useState } from "react";
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
      toast.error("กรุณากรอกรหัสห้อง");
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
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30">
      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto max-w-4xl px-4 sm:px-6 pt-16 pb-16 text-center flex-1 flex flex-col items-center justify-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.2]">
          แชร์หน้าจอ 1:1 แบบ{" "}
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            Real-Time P2P
          </span>
          <br />
          ความหน่วงต่ำ คมชัดระดับ 60 FPS
        </h1>

        <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          แพลตฟอร์มแชร์หน้าจอสำหรับสอนออนไลน์และทำงานร่วมกันแบบ Peer-to-Peer 
          ไม่ต้องติดตั้งโปรแกรม เชื่อมต่อผ่าน WebRTC โดยตรง
        </p>

        {/* Quick Launch & Join Box */}
        <div className="mt-8 w-full max-w-2xl">
          <Card className="p-2 sm:p-3 bg-card/90 border-border shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
              {/* Host Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-background border border-border/60 text-left">
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
                    สร้างห้องแล้วเริ่มแชร์หน้าจอพร้อมลิงก์เชิญผู้ชม
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
                  className="w-full font-semibold text-xs shadow-md"
                  onClick={handleQuickCreate}
                  disabled={isCreating}
                >
                  <MonitorPlay className="h-4 w-4 mr-1.5" />
                  {isCreating ? "กำลังสร้างห้อง..." : "เริ่มเปิดห้องแชร์หน้าจอ"}
                </Button>
              </div>

              {/* Viewer Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-background border border-border/60 text-left">
                <form onSubmit={handleJoin} className="h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <Tv className="h-5 w-5" />
                      </div>
                      <span className="font-semibold text-foreground text-sm">
                        เข้ารับชม (Viewer)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      ใส่รหัสห้องเพื่อเข้าร่วมชมภาพหน้าจอแบบความละเอียดสูง
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
                    className="w-full font-semibold text-xs"
                  >
                    เข้าร่วมห้อง
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>

        {/* 3 Core Highlights */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-left">
          <div className="p-4 rounded-xl bg-card/60 border border-border/50">
            <Zap className="h-5 w-5 text-amber-400 mb-2" />
            <h3 className="font-semibold text-xs text-foreground mb-1">Ultra Low Latency</h3>
            <p className="text-[11px] text-muted-foreground">ภาพและเสียงส่งตรงแบบ P2P ความหน่วงต่ำระดับมิลลิวินาที</p>
          </div>
          <div className="p-4 rounded-xl bg-card/60 border border-border/50">
            <Globe2 className="h-5 w-5 text-cyan-400 mb-2" />
            <h3 className="font-semibold text-xs text-foreground mb-1">Zero Install</h3>
            <p className="text-[11px] text-muted-foreground">ทำงานบนเบราว์เซอร์ 100% รองรับทั้งคอมพิวเตอร์และแท็บเล็ต</p>
          </div>
          <div className="p-4 rounded-xl bg-card/60 border border-border/50">
            <ShieldCheck className="h-5 w-5 text-emerald-400 mb-2" />
            <h3 className="font-semibold text-xs text-foreground mb-1">WebRTC Encrypted</h3>
            <p className="text-[11px] text-muted-foreground">เข้ารหัสข้อมูลระหว่างต้นทางถึงปลายทางด้วย DTLS-SRTP</p>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-border/40 py-6 bg-background">
        <div className="container mx-auto max-w-5xl px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>KShare — P2P Screen Sharing Platform</span>
          <span className="font-mono text-[11px]">v1.0 Production</span>
        </div>
      </footer>
    </div>
  );
}
