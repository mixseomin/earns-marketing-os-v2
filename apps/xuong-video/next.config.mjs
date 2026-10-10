/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },   // tsc chạy riêng trước khi đẩy (cùng nếp apps/web, apps/store)
  transpilePackages: ['@mos2/db', '@mos2/gop-y'],
  serverExternalPackages: ['postgres'],
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    return [{ source: '/((?!_next/static).*)', headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }] }];
  },
};
