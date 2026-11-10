import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "KShare — Ultra-Fast P2P Screen Sharing",
  description:
    "แชร์หน้าจอความละเอียดสูงแบบ Peer-to-Peer รวดเร็ว เสถียร ปลอดภัย ไม่ต้องติดตั้งโปรแกรม สำหรับการสอนและการทำงานร่วมกัน",
  keywords: ["screen share", "p2p", "webrtc", "kshare", "vdo ninja", "screen capture", "online teaching"]
};

export const viewport: Viewport = {
  themeColor: "#0f1117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/gh/lazywasabi/thai-web-fonts@main/fonts/LINESeedSansTH/LINESeedSansTH-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/gh/lazywasabi/thai-web-fonts@main/fonts/LINESeedSansTH/LINESeedSansTH-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased selection:bg-primary/30 selection:text-white">
        {children}
        <Toaster position="top-right" richColors theme="dark" />
      </body>
    </html>
  );
}
