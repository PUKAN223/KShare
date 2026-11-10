import fs from "fs";
import path from "path";
import zlib from "zlib";

interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8Array;
}

// Precompute CRC32 table for PNG encoding
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf: Buffer): DecodedPng {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "PLTE") {
      plte = Buffer.from(data);
    } else if (type === "tRNS") {
      trns = Buffer.from(data);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const channels =
    colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const bpp = Math.max(1, Math.ceil((bitDepth * channels) / 8));
  const stride = Math.ceil((width * bitDepth * channels) / 8);

  const unfiltered = new Uint8Array(height * stride);
  let rawOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++];
    const rowStart = y * stride;
    const prevRowStart = (y - 1) * stride;

    for (let i = 0; i < stride; i++) {
      const filt = raw[rawOffset++];
      const a = i >= bpp ? unfiltered[rowStart + i - bpp] : 0;
      const b = y > 0 ? unfiltered[prevRowStart + i] : 0;
      const c = y > 0 && i >= bpp ? unfiltered[prevRowStart + i - bpp] : 0;

      let val = filt;
      if (filterType === 1) {
        val = (filt + a) & 0xff;
      } else if (filterType === 2) {
        val = (filt + b) & 0xff;
      } else if (filterType === 3) {
        val = (filt + ((a + b) >>> 1)) & 0xff;
      } else if (filterType === 4) {
        val = (filt + paethPredictor(a, b, c)) & 0xff;
      }
      unfiltered[rowStart + i] = val;
    }
  }

  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;

      if (colorType === 6) {
        const srcIdx = rowStart + x * 4;
        rgba[outIdx] = unfiltered[srcIdx];
        rgba[outIdx + 1] = unfiltered[srcIdx + 1];
        rgba[outIdx + 2] = unfiltered[srcIdx + 2];
        rgba[outIdx + 3] = unfiltered[srcIdx + 3];
      } else if (colorType === 2) {
        const srcIdx = rowStart + x * 3;
        rgba[outIdx] = unfiltered[srcIdx];
        rgba[outIdx + 1] = unfiltered[srcIdx + 1];
        rgba[outIdx + 2] = unfiltered[srcIdx + 2];
        rgba[outIdx + 3] = 255;
      } else if (colorType === 3 && plte) {
        let palIdx = 0;
        if (bitDepth === 8) {
          palIdx = unfiltered[rowStart + x];
        } else if (bitDepth === 4) {
          const byte = unfiltered[rowStart + (x >> 1)];
          palIdx = x & 1 ? byte & 0x0f : (byte >> 4) & 0x0f;
        } else if (bitDepth === 2) {
          const byte = unfiltered[rowStart + (x >> 2)];
          const shift = (3 - (x & 3)) * 2;
          palIdx = (byte >> shift) & 0x03;
        } else if (bitDepth === 1) {
          const byte = unfiltered[rowStart + (x >> 3)];
          const shift = 7 - (x & 7);
          palIdx = (byte >> shift) & 0x01;
        }
        rgba[outIdx] = plte[palIdx * 3] || 0;
        rgba[outIdx + 1] = plte[palIdx * 3 + 1] || 0;
        rgba[outIdx + 2] = plte[palIdx * 3 + 2] || 0;
        rgba[outIdx + 3] = trns && palIdx < trns.length ? trns[palIdx] : 255;
      } else if (colorType === 4) {
        const srcIdx = rowStart + x * 2;
        const g = unfiltered[srcIdx];
        rgba[outIdx] = g;
        rgba[outIdx + 1] = g;
        rgba[outIdx + 2] = g;
        rgba[outIdx + 3] = unfiltered[srcIdx + 1];
      } else {
        const g = unfiltered[rowStart + x];
        rgba[outIdx] = g;
        rgba[outIdx + 1] = g;
        rgba[outIdx + 2] = g;
        rgba[outIdx + 3] = 255;
      }
    }
  }

  return { width, height, rgba };
}

function makeChunk(type: string, data: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowStride = width * 4;
  const rawData = Buffer.alloc(height * (rowStride + 1));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowStride + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    const srcOffset = y * rowStride;
    Buffer.from(rgba.buffer, rgba.byteOffset + srcOffset, rowStride).copy(
      rawData,
      rowOffset + 1
    );
  }

  const compressed = zlib.deflateSync(rawData, { level: 6 });

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

const iconCache = new Map<string, Buffer>();
let cachedSource: DecodedPng | null = null;

function findLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "scius-logo.png"),
    path.join(process.cwd(), "apps", "web", "public", "scius-logo.png"),
    path.resolve(__dirname, "../../../../public/scius-logo.png")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function generatePwaIconBuffer(
  size: number,
  options?: { opaqueBackground?: boolean; paddingRatio?: number }
): Buffer {
  const opaqueBackground = options?.opaqueBackground ?? false;
  const paddingRatio = options?.paddingRatio ?? (opaqueBackground ? 0.08 : 0.02);
  const cacheKey = `${size}_${opaqueBackground ? "opaque" : "trans"}_${paddingRatio}`;

  const existing = iconCache.get(cacheKey);
  if (existing) return existing;

  if (!cachedSource) {
    const logoPath = findLogoPath();
    if (!logoPath) {
      throw new Error("scius-logo.png not found");
    }
    cachedSource = decodePng(fs.readFileSync(logoPath));
  }

  const src = cachedSource;
  const dst = new Uint8Array(size * size * 4);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    if (opaqueBackground) {
      // Clean dark studio background (#18181b) so iOS/Android icons never render invisible black-on-black
      dst[idx] = 24;
      dst[idx + 1] = 24;
      dst[idx + 2] = 27;
      dst[idx + 3] = 255;
    } else {
      dst[idx] = 0;
      dst[idx + 1] = 0;
      dst[idx + 2] = 0;
      dst[idx + 3] = 0;
    }
  }

  const pad = Math.round(size * paddingRatio);
  const drawSize = Math.max(1, size - pad * 2);

  for (let dy = 0; dy < drawSize; dy++) {
    const sy = ((dy + 0.5) / drawSize) * src.height - 0.5;
    const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)));
    const y1 = Math.max(0, Math.min(src.height - 1, y0 + 1));
    const wy = sy - y0;

    for (let dx = 0; dx < drawSize; dx++) {
      const sx = ((dx + 0.5) / drawSize) * src.width - 0.5;
      const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)));
      const x1 = Math.max(0, Math.min(src.width - 1, x0 + 1));
      const wx = sx - x0;

      const i00 = (y0 * src.width + x0) * 4;
      const i10 = (y0 * src.width + x1) * 4;
      const i01 = (y1 * src.width + x0) * 4;
      const i11 = (y1 * src.width + x1) * 4;

      const w00 = (1 - wx) * (1 - wy);
      const w10 = wx * (1 - wy);
      const w01 = (1 - wx) * wy;
      const w11 = wx * wy;

      const r =
        src.rgba[i00] * w00 +
        src.rgba[i10] * w10 +
        src.rgba[i01] * w01 +
        src.rgba[i11] * w11;
      const g =
        src.rgba[i00 + 1] * w00 +
        src.rgba[i10 + 1] * w10 +
        src.rgba[i01 + 1] * w01 +
        src.rgba[i11 + 1] * w11;
      const b =
        src.rgba[i00 + 2] * w00 +
        src.rgba[i10 + 2] * w10 +
        src.rgba[i01 + 2] * w01 +
        src.rgba[i11 + 2] * w11;
      const a =
        (src.rgba[i00 + 3] * w00 +
          src.rgba[i10 + 3] * w10 +
          src.rgba[i01 + 3] * w01 +
          src.rgba[i11 + 3] * w11) /
        255;

      const outX = pad + dx;
      const outY = pad + dy;
      const dstIdx = (outY * size + outX) * 4;

      if (opaqueBackground) {
        dst[dstIdx] = Math.round(r * a + dst[dstIdx] * (1 - a));
        dst[dstIdx + 1] = Math.round(g * a + dst[dstIdx + 1] * (1 - a));
        dst[dstIdx + 2] = Math.round(b * a + dst[dstIdx + 2] * (1 - a));
        dst[dstIdx + 3] = 255;
      } else {
        dst[dstIdx] = Math.round(r);
        dst[dstIdx + 1] = Math.round(g);
        dst[dstIdx + 2] = Math.round(b);
        dst[dstIdx + 3] = Math.round(a * 255);
      }
    }
  }

  const outBuf = encodePng(size, size, dst);
  iconCache.set(cacheKey, outBuf);
  return outBuf;
}

let iconsWrittenToDisk = false;

export function ensurePwaIconsGenerated(): void {
  if (iconsWrittenToDisk) return;
  try {
    const logoPath = findLogoPath();
    if (!logoPath) return;
    const publicDir = path.dirname(logoPath);

    const targets: Array<{
      name: string;
      size: number;
      opaqueBackground: boolean;
      paddingRatio: number;
    }> = [
      {
        name: "apple-touch-icon.png",
        size: 180,
        opaqueBackground: true,
        paddingRatio: 0.06
      },
      {
        name: "apple-touch-icon-precomposed.png",
        size: 180,
        opaqueBackground: true,
        paddingRatio: 0.06
      },
      {
        name: "icon-192.png",
        size: 192,
        opaqueBackground: true,
        paddingRatio: 0.05
      },
      {
        name: "icon-512.png",
        size: 512,
        opaqueBackground: true,
        paddingRatio: 0.05
      },
      {
        name: "icon-maskable-192.png",
        size: 192,
        opaqueBackground: true,
        paddingRatio: 0.12
      },
      {
        name: "icon-maskable-512.png",
        size: 512,
        opaqueBackground: true,
        paddingRatio: 0.12
      }
    ];

    for (const t of targets) {
      const buf = generatePwaIconBuffer(t.size, {
        opaqueBackground: t.opaqueBackground,
        paddingRatio: t.paddingRatio
      });
      fs.writeFileSync(path.join(publicDir, t.name), buf);
    }

    iconsWrittenToDisk = true;
  } catch (err) {
    console.error("Failed to write static PWA icons:", err);
  }
}
