/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GAME_SERVER_URL: process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:2567",
    NEXT_PUBLIC_GAME_CLIENT_URL: process.env.NEXT_PUBLIC_GAME_CLIENT_URL || "http://localhost:3001",
  },
  async rewrites() {
    return [
      {
        source: "/api/game/:path*",
        destination: `${process.env.GAME_SERVER_URL || "http://localhost:2567"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
