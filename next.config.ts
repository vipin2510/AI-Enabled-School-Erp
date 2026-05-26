import type { NextConfig } from "next";
import path from "node:path";

// Allow next/image to optimize photos served from the Supabase Storage bucket.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't infer the
  // parent home-directory lockfile.
  turbopack: { root: path.resolve(__dirname) },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
