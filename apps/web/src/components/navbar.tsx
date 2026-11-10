"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Input } from "@kshare/ui";
import {
  MonitorUp,
  Share2,
  LayoutDashboard,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { formatRoomCode } from "@kshare/protocol";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [quickCode, setQuickCode] = useState("");

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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/85 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform">
            <MonitorUp className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            KShare
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              pathname === "/"
                ? "text-foreground bg-secondary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            หน้าหลัก
          </Link>
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname.startsWith("/dashboard")
                ? "text-foreground bg-secondary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            แดชบอร์ด
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <form onSubmit={handleJoin} className="flex items-center relative">
            <Input
              value={quickCode}
              onChange={(e) => setQuickCode(formatRoomCode(e.target.value))}
              placeholder="รหัสห้อง (KSH-8492)"
              className="h-9 w-36 sm:w-44 text-xs uppercase tracking-wider rounded-lg pr-7 bg-card/80 border-border/70"
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
              สร้างห้อง
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
