import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
