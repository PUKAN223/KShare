import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@kshare/ui",
    "@kshare/protocol",
    "@kshare/validators",
    "@kshare/database",
    "@kshare/capture",
    "@kshare/screen-share",
    "@kshare/provider-vdo-ninja"
  ]
};

export default nextConfig;
