import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": ["./public/files/**/*"],
  },
};

export default nextConfig;
