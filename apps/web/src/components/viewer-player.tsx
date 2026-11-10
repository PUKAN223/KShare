"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@kshare/ui";
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  ArrowLeft
} from "lucide-react";
import { WebRTCViewerPeer } from "@/lib/webrtc-peer";
import { RoomStatus } from "@kshare/protocol";
import { toast } from "sonner";

interface ViewerPlayerProps {
  roomCode: string;
  initialRoomName: string;
}

export function ViewerPlayer({ roomCode, initialRoomName }: ViewerPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peerRef = useRef<WebRTCViewerPeer | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [statusText, setStatusText] = useState("กำลังเชื่อมต่อห้องแชร์หน้าจอ...");

  useEffect(() => {
    let isMounted = true;

    // 1. Join room on server
    fetch(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Viewer" })
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.room?.name) setRoomName(data.room.name);
      })
      .catch(() => {});

    // 2. Initialize WebRTC P2P Receiver
    const peer = new WebRTCViewerPeer(
      roomCode,
      (remoteStream) => {
        if (!isMounted) return;
        setIsLive(true);
        setStatusText("รับสัญญาณภาพหน้าจอสดแล้ว");

        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current
            .play()
            .catch(() => {
              // If browser requires user interaction for sound, mute and play video first
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                videoRef.current.play().catch(() => {});
              }
            });
        }
      },
      (iceState) => {
        if (!isMounted) return;
        if (iceState === "connected" || iceState === "completed") {
          setStatusText("เชื่อมต่อ P2P สำเร็จ");
        } else if (iceState === "disconnected") {
          setStatusText("สัญญาณขาดหาย กำลังรอภาพ...");
        }
      }
    );

    peerRef.current = peer;
    peer.start();

    // 3. Poll room state (if host stops sharing)
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room?.status === RoomStatus.IDLE) {
            setIsLive(false);
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
          }
        }
      } catch {
        // ignore
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, [roomCode]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col relative text-foreground">
      {/* Clean Production Viewer Bar */}
      <div className="h-14 border-b border-white/10 bg-black/80 backdrop-blur-md px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-xs h-8 px-2 text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            ออก
          </Button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white">{roomName}</span>
            <Badge
              variant={isLive ? "live" : "secondary"}
              dot
              pulse={isLive}
              className="font-mono text-xs uppercase"
            >
              {roomCode}
            </Badge>
          </div>
        </div>

        {/* Minimal Viewer Controls */}
        <div className="flex items-center gap-2">
          {isLive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="text-xs h-8 px-2 text-white hover:bg-white/10"
              title={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="text-xs h-8 px-2.5 border-white/20 text-white hover:bg-white/10"
            title="เต็มจอ"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Cinematic Video Player Container */}
      <main
        ref={containerRef}
        className="flex-1 w-full h-full flex items-center justify-center relative bg-black overflow-hidden"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className={`w-full h-full object-contain max-h-[calc(100vh-3.5rem)] ${
            isLive ? "block" : "hidden"
          }`}
        />

        {/* Clean Waiting Screen */}
        {!isLive && (
          <div className="text-center p-8 flex flex-col items-center max-w-md">
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary mb-4">
              <Radio className="h-8 w-8 animate-pulse text-primary" />
            </div>
            <h3 className="font-bold text-white text-xl mb-1.5">
              กำลังรอผู้สอนเริ่มแชร์หน้าจอ...
            </h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              ภาพหน้าจอจะแสดงขึ้นบนอุปกรณ์นี้โดยอัตโนมัติทันทีที่ผู้สอนเริ่มกดแชร์หน้าจอ
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-xs text-neutral-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              สถานะ: {statusText}
            </div>
          </div>
        )}

        {/* Live Indicator Tag */}
        {isLive && (
          <div className="absolute top-4 right-4 z-20 pointer-events-none">
            <Badge variant="live" dot pulse className="shadow-lg">
              LIVE STREAM
            </Badge>
          </div>
        )}
      </main>
    </div>
  );
}
