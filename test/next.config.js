/** @type {import('next').NextConfig} */
const nextConfig = {
  headers() {
    return Promise.resolve([
      {
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
        source: "/oidc/:path*",
      },
    ]);
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};
module.exports = nextConfig;
