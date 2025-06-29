import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://157.180.71.65:3000/"
  ]
};

export default nextConfig;
