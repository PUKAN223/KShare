"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button, Card, Input } from "@kshare/ui";
import { MonitorUp, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { RegisterSchema } from "@kshare/validators";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = RegisterSchema.safeParse({ name, email, password });
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("สมัครสมาชิกสำเร็จ ยินดีต้อนรับสู่ KShare");
      router.push("/dashboard");
    }, 600);
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
            <h1 className="text-2xl font-bold text-foreground">สมัครสมาชิก KShare</h1>
            <p className="text-xs text-muted-foreground mt-1">
              สร้างบัญชีเพื่อเริ่มแชร์หน้าจอแบบไร้ขีดจำกัด
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                ชื่อ-นามสกุล / ชื่อแสดงผล *
              </label>
              <Input
                placeholder="เช่น สมชาย ใจดี"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                อีเมล (Email) *
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
              <label className="block text-xs font-medium text-foreground mb-1.5">
                รหัสผ่าน (Password อย่างน้อย 6 ตัวอักษร) *
              </label>
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
              <UserPlus className="h-4 w-4 mr-1.5" />
              {isSubmitting ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/40 text-center text-xs text-muted-foreground">
            มีบัญชีผู้ใช้งานแล้ว?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              เข้าสู่ระบบ
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
