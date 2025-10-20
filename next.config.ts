import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Note: Next 15 shows a dev warning for cross-origin dev assets. If needed,
  // configure allowedDevOrigins per docs once your framework version exposes it.
};

export default nextConfig;
