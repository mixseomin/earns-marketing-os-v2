/** @type {import('next').NextConfig} */
const nextConfig = {
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
    cpus: 2,
  },
};

export default nextConfig;
