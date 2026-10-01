/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },   // tsc chạy riêng trước khi đẩy (cùng nếp apps/web)
  transpilePackages: ['@mos2/shop', '@mos2/db'],
  serverExternalPackages: ['nodemailer', 'postgres'],
  // Cloudflare đứng trước mọi tên miền shop: HTML phải KHÔNG được cache ở biên (bẫy s-maxage 1 năm — giá/giỏ cũ tới tay khách).
  async headers() {
    return [{ source: '/((?!_next/static).*)', headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }] }];
  },
};
