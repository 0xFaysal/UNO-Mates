import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { webpackMemoryOptimizations: true },
  async headers() {
    return [{ source: '/cards/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] }];
  },
};

export default nextConfig;
