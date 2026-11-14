/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },   // tsc chạy riêng trước khi đẩy (cùng nếp apps/web, apps/store)
  transpilePackages: ['@mos2/db', '@mos2/gop-y', '@mos2/bang'],
  serverExternalPackages: ['postgres'],
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    // Trừ /api/xv/nho (14/11/2026): chuyển hướng ảnh nhỏ tự đặt "nhớ 1 năm" — luật no-store chung đè mất, mỗi lần timeline sang shot lại tốn ~0,4 s gọi máy chủ.
    return [{ source: '/((?!_next/static|api/xv/nho).*)', headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }] }];
  },
};
