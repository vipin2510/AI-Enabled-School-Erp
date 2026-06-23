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
  // Server Actions default to a 1 MB body limit — too tight for a
  // student/parent photo plus the rest of the form fields. 3 MB leaves
  // headroom on top of the per-photo 2 MB UI cap below; anything bigger
  // gets refused client-side with a clear "max 2 MB" message instead of
  // surfacing as a generic "An unexpected response was received from the
  // server" page.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
