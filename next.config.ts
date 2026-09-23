import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@prisma/client", "@prisma/hrms-client", "bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async redirects() {
    return [{ source: "/hr/dashboard", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
