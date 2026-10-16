import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { lanAddresses } from "./src/lib/lan";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev server opened from a phone on the same Wi-Fi (pnpm dev:lan); used only by next dev.
  allowedDevOrigins: lanAddresses(networkInterfaces()),
  cacheComponents: true,
  partialPrefetching: true,
  // Screens that moved out of Docházka (step 5.1); old bookmarks keep working.
  async redirects() {
    return [
      {
        source: "/timesheets/jobs/:path*",
        destination: "/jobs/:path*",
        permanent: true,
      },
      {
        source: "/timesheets/employees/:path*",
        destination: "/employees/:path*",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
