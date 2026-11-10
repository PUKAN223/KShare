"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Badge, Input } from "@kshare/ui";
import {
  MonitorUp,
  Share2,
  Sparkles,
  LayoutDashboard,
  LogIn,
  Layers,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { formatRoomCode } from "@kshare/protocol";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [quickCode, setQuickCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCode.trim()) {
      toast.error("กรุณากรอกรหัสห้อง");
      return;
    }
    const clean = quickCode.toUpperCase().replace(/\s+/g, "");
    router.push(`/room/${clean}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl transition-all">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-0.5 shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-background">
              <MonitorUp className="h-5 w-5 text-primary group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                KShare
              </span>
              <Badge variant="cyber" className="py-0 px-1.5 text-[10px] font-mono">
                P2P v1.0
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground/80 tracking-wide font-medium">
              WebRTC Screen Sharing
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/"
                ? "text-primary bg-primary/10 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            หน้าหลัก
          </Link>
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname.startsWith("/dashboard")
                ? "text-primary bg-primary/10 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            แดชบอร์ด
          </Link>
          <Link
            href="/system-check"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/system-check"
                ? "text-primary bg-primary/10 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            ทดสอบระบบ WebRTC
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Quick Join Button / Form */}
          <form onSubmit={handleJoin} className="hidden sm:flex items-center relative">
            <Input
              value={quickCode}
              onChange={(e) => setQuickCode(formatRoomCode(e.target.value))}
              placeholder="ใส่รหัสห้อง (เช่น KSH-8492)"
              className="h-9 w-44 lg:w-52 text-xs uppercase tracking-wider rounded-lg pr-8 bg-card/80 border-border/70"
              maxLength={8}
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
              title="เข้าร่วมห้อง"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          <Link href="/dashboard?create=true">
            <Button variant="gradient" size="sm" className="hidden sm:flex gap-1.5 text-xs font-semibold">
              <Share2 className="h-3.5 w-3.5" />
              สร้างห้องใหม่
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
