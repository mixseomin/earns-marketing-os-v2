/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },   // tsc chạy riêng trước khi đẩy (cùng nếp apps/web, apps/cty)
  transpilePackages: ['@mos2/db', '@mos2/gop-y', '@mos2/bang'],
  serverExternalPackages: ['postgres'],
  async headers() {
    return [{ source: '/((?!_next/static).*)', headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }] }];
  },
};
