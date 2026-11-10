"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Badge } from "@kshare/ui";
import { MonitorUp, LogIn, UserCheck, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LoginSchema } from "@kshare/validators";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"account" | "guest">("account");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = LoginSchema.safeParse({ email, password });
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || "กรุณาตรวจสอบข้อมูล");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("เข้าสู่ระบบสำเร็จ");
      router.push("/dashboard");
    }, 600);
  };

  const handleGuestEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error("กรุณากรอกชื่อแสดงตน");
      return;
    }
    toast.success(`เข้าใช้งานแบบ Guest: ${guestName}`);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Card glow className="w-full max-w-md p-6 sm:p-8 bg-card/85 backdrop-blur-2xl border-border/80 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-0.5 shadow-lg shadow-orange-500/20 mb-3">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-background">
                <MonitorUp className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">เข้าสู่ระบบ KShare</h1>
            <p className="text-xs text-muted-foreground mt-1">
              แพลตฟอร์มแชร์หน้าจอ P2P สำหรับการสอนและการทำงานร่วมกัน
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 p-1 bg-secondary/80 rounded-xl mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode("account")}
              className={`py-2 rounded-lg transition-all ${
                mode === "account"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              บัญชีผู้ใช้งาน
            </button>
            <button
              type="button"
              onClick={() => setMode("guest")}
              className={`py-2 rounded-lg transition-all ${
                mode === "guest"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              เข้าใช้งานแบบ Guest
            </button>
          </div>

          {mode === "account" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  อีเมล (Email)
                </label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">
                    รหัสผ่าน (Password)
                  </label>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="gradient"
                className="w-full font-semibold mt-2"
                disabled={isSubmitting}
              >
                <LogIn className="h-4 w-4 mr-1.5" />
                {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleGuestEnter} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  ชื่อแสดงตน (Display Name)
                </label>
                <Input
                  placeholder="เช่น นักเรียนสมชาย, คุณครูเอก"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                การเข้าใช้งานแบบ Guest ช่วยให้คุณสามารถสร้างห้องหรือเข้าร่วมห้องได้ทันทีโดยไม่ต้องลงทะเบียน
              </p>

              <Button
                type="submit"
                variant="cyber"
                className="w-full font-semibold mt-2"
              >
                <UserCheck className="h-4 w-4 mr-1.5" />
                เข้าใช้งานทันที
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-border/40 text-center text-xs text-muted-foreground">
            ยังไม่มีบัญชีผู้ใช้?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              สมัครสมาชิกใหม่
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
