import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { webpackMemoryOptimizations: true },
  async headers() {
    return [{ source: '/cards/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },{source:'/faysal/:path*',headers:[{key:'Cache-Control',value:'private, no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},{key:'X-Frame-Options',value:'DENY'},{key:'Content-Security-Policy',value:"frame-ancestors 'none'"},{key:'Referrer-Policy',value:'no-referrer'}]}];
  },
};

export default nextConfig;
