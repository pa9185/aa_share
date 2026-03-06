import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pdf-parse uses canvas optionally – silence the warning
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
