# KShare — Peer-to-Peer Screen Sharing Platform

> A lightweight, ultra-low latency, peer-to-peer screen sharing platform for online teaching and remote collaboration. Designed with a modern, high-contrast dark aesthetic inspired by **Fastory** and **RuffBlitz**.

---

## ⚡ Overview

**KShare** เป็นแพลตฟอร์มแชร์หน้าจอแบบ Web-based 1:1 Peer-to-Peer (P2P) ที่พัฒนาขึ้นโดยเน้น:
1. **ความหน่วงต่ำเป็นพิเศษ (Ultra-Low Latency):** ส่งสัญญาณภาพและเสียงโดยตรงระหว่าง Host และ Viewer ผ่าน WebRTC Data/Media Channel
2. **ความคมชัดสูง (High Definition):** รองรับความละเอียดสูงสุดถึง 4K 60FPS พร้อมระบบปรับปรุงเสียง
3. **ไม่ต้องติดตั้งโปรแกรม (Zero-Install):** ทำงานบน Web Browser 100% ผ่าน MediaDevices API
4. **โครงสร้างสถาปัตยกรรมแบบ Adapter (Adapter Architecture):** แยก Business Logic และ UI ออกจาก Media Engine โดย V1 ขับเคลื่อนด้วย VDO.Ninja SDK และพร้อมสลับไปใช้ Native WebRTC หรือ SFU (LiveKit) ในอนาคต
5. **Modern UI/UX Design System:** ดีไซน์สไตล์ Deep Dark Slate ด้วย OKLCH Color System, Cyber Amber & Gradient Accents, ฟอนต์ LINE Seed Sans TH, Floating HUDs, และ QR Code แบบรวดเร็ว

---

## 🛠️ Architecture

```text
                           +----------------------+
                           |   apps/web (Next)    |
                           +----------+-----------+
                                      |
       +------------------------------+-------------------------------+
       |                              |                               |
       v                              v                               v
+---------------+            +------------------+            +------------------+
|  packages/ui  |            | packages/capture |            |  packages/proto  |
+---------------+            +--------+---------+            +------------------+
                                      |
                                      v
                             +-------------------+
                             | packages/screen-  |
                             |      share        |
                             +--------+----------+
                                      | (implements)
                                      v
                             +-------------------+
                             | provider-vdo-     |
                             |      ninja        |
                             +-------------------+
                                      |
                            WebRTC P2P / TURN Relay
```

### Monorepo Packages

| Package | Path | หน้าที่ความรับผิดชอบ |
|---|---|---|
| **apps/web** | `apps/web` | Next.js 15 App Router Frontend, Studio, Player, API Routes |
| **@kshare/ui** | `packages/ui` | Shared UI Design System (Button, Card, Badge, Input) |
| **@kshare/protocol** | `packages/protocol` | Enums, Room code formatters (`KSH-XXXX`), MediaQualityStats |
| **@kshare/validators** | `packages/validators` | Zod validation schemas (Auth, Room creation, Joining) |
| **@kshare/database** | `packages/database` | Prisma Client schema (User, Room, RoomMembership, Session) |
| **@kshare/capture** | `packages/capture` | Browser Screen & Audio Capture Manager (getDisplayMedia) |
| **@kshare/screen-share** | `packages/screen-share` | ScreenShareAdapter interface & Adapter events |
| **@kshare/provider-vdo-ninja** | `packages/provider-vdo-ninja` | Implementation of VDO.Ninja P2P WebRTC adapter |

---

## 🚀 Getting Started

### ความต้องการพื้นฐาน
- **Node.js** >= 20.0
- **pnpm** >= 10.0 (หรือ bun)

### ติดตั้ง Dependencies
```bash
pnpm install
```

### สร้าง Prisma Client
```bash
pnpm --filter @kshare/database db:generate
```

### เริ่มต้น Dev Server
```bash
pnpm --filter web dev
```
เปิดบราวเซอร์ที่ [http://localhost:3000](http://localhost:3000)

---

## 🎯 Key Features

### 1. Host Studio (`/room/[code]/host`)
- จับภาพหน้าจอ (Entire Screen, Application Window, หรือ Browser Tab)
- ปรับแต่งเฟรมเรทสูงสุด 60FPS และ Resolution สูงสุด 4K
- แชร์เสียงระบบ (System Audio) ควบคู่กับภาพ
- Floating Dock ควบคุมการแชร์, สลับหน้าจอ, เปิด/ปิดไมค์, และ Picture-in-Picture
- ป๊อปอัปเชิญผู้ชมพร้อม **QR Code แบบ Fastory** และลิงก์เชิญแบบ 1-Click Copy
- Real-time HUD แสดงสถิติ: Latency (ms), Resolution, Frame Rate, Bitrate, และประเภท ICE (P2P vs TURN Relay)

### 2. Viewer Cinematic Player (`/room/[code]/view`)
- แสดงผลภาพหน้าจอแบบความละเอียดสูงเต็มพื้นที่
- โหมด Theater และโหมดเต็มหน้าจอ (Full Screen)
- ปรับระดับเสียง / ปิดเสียงแยกอิสระ
- ระบบเชื่อมต่อใหม่อัตโนมัติ (Auto-reconnection) เมื่อสัญญาณขาดหาย
- Real-time WebRTC Metrics Overlay

### 3. System Diagnostics (`/system-check`)
- ตรวจสอบความพร้อมของ Browser APIs (`getDisplayMedia`, `RTCPeerConnection`)
- ทดสอบการ Ping STUN Server เพื่อประเมินความเร็วและไฟร์วอลล์
- ทดสอบลองแชร์หน้าจอดูก่อนเปิดห้องจริง

---

## 🛡️ Security & Privacy
- **WebRTC Encryption:** ข้อมูลภาพและเสียงทั้งหมดส่งผ่านการเข้ารหัส DTLS-SRTP
- **No Server Storage:** สตรีมภาพหน้าจอไม่มีการเก็บหรือบันทึกไว้ในเซิร์ฟเวอร์
- **Unique Room Codes:** รหัสห้องสุ่มแบบคละตัวอักษรและตัวเลข ป้องกันการสุ่มเจาะ
