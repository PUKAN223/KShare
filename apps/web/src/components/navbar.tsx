"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button, Input, Badge } from "@kshare/ui";
import {
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
    <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/90 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* SCiUS วมว. Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-11 w-11 shrink-0 rounded-full border border-primary/40 p-0.5 bg-black/40 shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center overflow-hidden">
            <Image
              src="/scius-logo.png"
              alt="ตราสัญลักษณ์ โครงการ วมว."
              width={42}
              height={42}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                SCiUS <span className="text-primary">Share</span>
              </span>
              <Badge variant="outline" className="py-0 px-1.5 text-[10px] font-medium border-primary/30 text-primary">
                วมว. อว.
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline leading-none">
              ห้องเรียนวิทยาศาสตร์ในโรงเรียนโดยการกำกับดูแลของมหาวิทยาลัย
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              pathname === "/"
                ? "text-primary bg-primary/10 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            หน้าหลัก
          </Link>
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname.startsWith("/dashboard")
                ? "text-primary bg-primary/10 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            ห้องเรียนของฉัน
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <form onSubmit={handleJoin} className="flex items-center relative">
            <Input
              value={quickCode}
              onChange={(e) => setQuickCode(formatRoomCode(e.target.value))}
              placeholder="รหัสห้อง (KSH-8492)"
              className="h-9 w-36 sm:w-44 text-xs uppercase tracking-wider rounded-lg pr-7 bg-card border-border/80"
              maxLength={8}
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
              title="เข้าร่วมห้องเรียน"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          <Link href="/dashboard?create=true">
            <Button variant="default" size="sm" className="hidden sm:flex gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
              <Share2 className="h-3.5 w-3.5" />
              เปิดห้องเรียน
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
