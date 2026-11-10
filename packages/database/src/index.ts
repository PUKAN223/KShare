import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function normalizeDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    // Automatically convert Supabase IPv6-only direct host (db.<ref>.supabase.co:5432)
    // to the IPv4-compatible Supavisor Transaction Pooler so Vercel Serverless (IPv4-only) can connect.
    const hostMatch = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (hostMatch) {
      const projectRef = hostMatch[1];
      const poolerRegion =
        process.env.SUPABASE_POOLER_HOST || "aws-1-ap-southeast-1.pooler.supabase.com";
      parsed.hostname = poolerRegion;
      parsed.port = "6543";
      if (!parsed.username.includes(".")) {
        parsed.username = `${parsed.username}.${projectRef}`;
      }
      if (!parsed.searchParams.has("pgbouncer")) {
        parsed.searchParams.set("pgbouncer", "true");
      }
      if (!parsed.searchParams.has("connection_limit")) {
        parsed.searchParams.set("connection_limit", "5");
      }
      return parsed.toString();
    }
  } catch {
    // ignore URL parse error
  }
  return rawUrl;
}

function ensureEnvLoaded(): void {
  if (!process.env.DATABASE_URL) {
    const candidates = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "../../.env"),
      path.resolve(__dirname, "../../../.env")
    ];
    for (const envPath of candidates) {
      try {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, "utf8");
          for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
          if (process.env.DATABASE_URL) break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);
  }
}

ensureEnvLoaded();

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  ensureEnvLoaded();
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();
globalThis.prismaGlobal = prisma;

export * from "@prisma/client";
