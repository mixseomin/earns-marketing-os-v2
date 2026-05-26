/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint via editor + pre-commit; skip in CI build to save 5-10s.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
