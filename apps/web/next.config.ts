import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./.prisma/client/**/*",
      "./.next/server/**/*",
      "../../node_modules/.prisma/client/**/*",
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/**/*"
    ]
  },
  transpilePackages: [
    "@kshare/ui",
    "@kshare/protocol",
    "@kshare/validators",
    "@kshare/database",
    "@kshare/capture",
    "@kshare/screen-share",
    "@kshare/provider-vdo-ninja"
  ],
  allowedDevOrigins: [
    "10.194.152.189"
  ]
};

export default nextConfig;
