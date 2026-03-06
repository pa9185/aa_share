import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for Docker multi-stage build
  webpack: (config) => {
    // pdf-parse uses canvas optionally – silence the missing-module warning
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
