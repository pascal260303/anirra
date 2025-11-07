import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  env: {
    HEADER_AUTH_ENABLED: process.env.HEADER_AUTH_ENABLED,
    HEADER_AUTH_LOGOUT_URL: process.env.HEADER_AUTH_LOGOUT_URL,
    HEADER_AUTH_USERNAME_HEADER: process.env.HEADER_AUTH_USERNAME_HEADER,
    HEADER_AUTH_EMAIL_HEADER: process.env.HEADER_AUTH_EMAIL_HEADER,
    API_URL: process.env.API_URL,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
