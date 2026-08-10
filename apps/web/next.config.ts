import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Opt out of the Next.js ESLint integration — we use the root flat config instead
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript type-checking is handled by the root `pnpm typecheck` command
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
