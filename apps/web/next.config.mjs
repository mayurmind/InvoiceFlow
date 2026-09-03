/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://localhost:5000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
