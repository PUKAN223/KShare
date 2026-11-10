import { NextRequest, NextResponse } from "next/server";
import {
  generatePwaIconBuffer,
  ensurePwaIconsGenerated
} from "@/lib/pwa-icon-generator";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    ensurePwaIconsGenerated();

    const sizeParam = Number(req.nextUrl.searchParams.get("size") || "192");
    const size = [180, 192, 512].includes(sizeParam) ? sizeParam : 192;
    const isMaskable = req.nextUrl.searchParams.get("maskable") === "1";

    const outBuffer = generatePwaIconBuffer(size, {
      opaqueBackground: true,
      paddingRatio: isMaskable ? 0.12 : 0.05
    });

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(outBuffer.length),
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    console.error("Error generating PWA icon:", error);
    return new NextResponse("Failed to generate icon", { status: 500 });
  }
}
