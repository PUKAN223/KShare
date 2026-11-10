import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "SCiUS Share — ระบบแชร์หน้าจอห้องเรียนวิทยาศาสตร์ วมว. (กระทรวง อว.)",
  description:
    "ระบบแชร์หน้าจอและถ่ายทอดสดแบบ Peer-to-Peer สำหรับโครงการสนับสนุนการจัดตั้งห้องเรียนวิทยาศาสตร์ในโรงเรียน โดยการกำกับดูแลของมหาวิทยาลัย (วมว.) กระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม",
  icons: {
    icon: "/scius-logo.png",
    apple: "/scius-logo.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
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
        <link rel="icon" href="/scius-logo.png" type="image/png" />
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
