import path from 'node:path';
import { fileURLToPath } from 'node:url';
// THÀNH PHỐ DÙNG CHUNG VỚI etp2 (anh 15/11/2026, card #1605 "mở băng etp.on.tc, dùng chung mã"): tab Thành phố của etp.on.tc import thẳng
// apps/etp2/src (alias @etp2/thanh-pho). Tệp trong apps/etp2/src gọi '@/…' thì phải về apps/etp2/src, không về apps/web/src — plugin bên dưới đổi đúng chỗ đó.
const ETP2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../etp2/src');
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { webpack }) => {
    config.resolve.alias = { ...config.resolve.alias, '@etp2/thanh-pho': path.join(ETP2, 'components/etp-tong2-widget.tsx') };
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\//, (r) => {
      if (r.context && path.resolve(r.context).startsWith(ETP2)) r.request = path.join(ETP2, r.request.slice(2));
    }));
    return config;
  },
  distDir: process.env.NEXT_DIST_DIR || '.next',   // deploy.sh dựng trên box vào .next.new rồi thay liền lúc khởi động lại (02/11/2026: dựng thẳng vào .next = 500 suốt lúc dựng)
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint via editor + pre-commit; skip in CI build to save 5-10s.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type-check runs pre-push (`tsc --noEmit`) + deploy guards (check-sql-aliases,
    // check-canon) catch the runtime-drift classes. Skipping the in-build tsc pass
    // saves ~15-30s/deploy. Keep the pre-push tsc discipline.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Deploy box is memory-tight (~1Gi free during build; next build worker got SIGKILL'd
    // by the OOM killer). Lower peak build memory: webpack memory optimizations + cap the
    // page-generation workers so the build fits.
    webpackMemoryOptimizations: true,
    externalDir: true,   // dựng mã apps/etp2/src (Thành phố dùng chung)
    cpus: 2,
  },
};

export default nextConfig;
