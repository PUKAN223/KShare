"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { UserRole, RoomStatus, formatRoomCode } from "@kshare/protocol";
import { HostStudio } from "@/components/host-studio";
import { ViewerPlayer } from "@/components/viewer-player";
import { RoomHostSettings } from "@/lib/room-types";
import { AlertCircle, ArrowLeft, Lock, KeyRound } from "lucide-react";

interface RoomData {
  code: string;
  name: string;
  subject?: string;
  status: RoomStatus;
  settings?: RoomHostSettings;
}

function detectDeviceHint(): string {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  return "Browser";
}

function getOrCreateViewerId(): string {
  if (typeof window === "undefined") return "v_server";
  const key = "kshare_viewer_id";
  let existing = sessionStorage.getItem(key);
  if (!existing) {
    existing = "v_" + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem(key, existing);
  }
  return existing;
}

function RoomDispatcherContent() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = (params.code || "").toUpperCase();
  const queryToken = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPin, setRequiresPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [hostToken, setHostToken] = useState<string>("");
  const [viewerId, setViewerId] = useState<string>("v_default");
  const [roomData, setRoomData] = useState<RoomData | null>(null);

  const verifyAndJoin = useCallback(
    async (suppliedPin?: string) => {
      try {
        setLoading(true);
        setError(null);

        const formatted = formatRoomCode(code);
        const storedHostToken =
          typeof window !== "undefined"
            ? sessionStorage.getItem(`kshare_host_${code}`) ||
              localStorage.getItem(`kshare_host_${code}`) ||
              sessionStorage.getItem(`kshare_host_${formatted}`) ||
              localStorage.getItem(`kshare_host_${formatted}`)
            : null;
        const effectiveToken = queryToken || storedHostToken || undefined;
        const currentViewerId = getOrCreateViewerId();
        setViewerId(currentViewerId);

        const storedName =
          typeof window !== "undefined"
            ? localStorage.getItem("kshare_viewer_name") || undefined
            : undefined;

        const res = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: effectiveToken,
            viewerId: currentViewerId,
            displayName: storedName,
            deviceHint: detectDeviceHint(),
            pinCode: suppliedPin ?? (searchParams.get("pin") || undefined)
          })
        });

        const data = await res.json();

        if (res.status === 401 && data.requiresPin) {
          setRequiresPin(true);
          if (suppliedPin) {
            setError(data.error || "รหัส PIN ไม่ถูกต้อง");
          }
          return;
        }

        if (!res.ok) {
          setError(data.error || "ไม่พบห้องแชร์หน้าจอนี้ หรือห้องถูกปิดไปแล้ว");
          return;
        }

        setRequiresPin(false);
        setRole(data.role);
        setRoomData(data.room);

        if (data.role === UserRole.HOST && effectiveToken) {
          setHostToken(effectiveToken);
          sessionStorage.setItem(`kshare_host_${code}`, effectiveToken);
        }
      } catch {
        setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
      } finally {
        setLoading(false);
      }
    },
    [code, queryToken, searchParams]
  );

  useEffect(() => {
    if (code) {
      verifyAndJoin();
    }
  }, [code, verifyAndJoin]);

  if (loading && !requiresPin) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">
            กำลังเชื่อมต่อห้อง {formatRoomCode(code)}...
          </p>
        </div>
      </div>
    );
  }

  if (requiresPin) {
    return (
      <div className="min-h-screen bg-[#09090b] bg-studio-grid text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full p-6 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                ห้องนี้มีรหัส PIN
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                {formatRoomCode(code)}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyAndJoin(pinInput);
            }}
            className="space-y-3"
          >
            <div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="กรอกรหัส PIN"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-zinc-950 border border-white/10 text-sm font-mono tracking-widest text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold"
              >
                เข้าห้อง
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (error || !roomData) {
    return (
      <div className="min-h-screen bg-[#09090b] bg-studio-grid text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900/95 border border-white/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-zinc-100">ไม่สามารถเข้าห้องได้</h1>
          <p className="text-xs text-zinc-400">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  if (role === UserRole.HOST) {
    return (
      <HostStudio
        roomCode={roomData.code}
        roomName={roomData.name}
        subject={roomData.subject}
        hostToken={hostToken}
        initialSettings={roomData.settings}
      />
    );
  }

  return (
    <ViewerPlayer
      roomCode={roomData.code}
      roomName={roomData.name}
      subject={roomData.subject}
      viewerId={viewerId}
      initialStatus={roomData.status}
      initialSettings={roomData.settings}
    />
  );
}

export default function RoomDispatcherPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <RoomDispatcherContent />
    </Suspense>
  );
}
