import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import path from "node:path";

// Allow next/image to optimize photos served from the Supabase Storage bucket
// (legacy URLs) and from the Cloudflare R2 public bucket (current). Both hosts
// are whitelisted so existing photos keep loading after the storage migration.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;
const r2Host = process.env.R2_PUBLIC_BASE_URL
  ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname
  : undefined;

const remotePatterns: RemotePattern[] = [];
if (supabaseHost) {
  remotePatterns.push({
    protocol: "https",
    hostname: supabaseHost,
    pathname: "/storage/v1/object/public/**",
  });
}
if (r2Host) {
  remotePatterns.push({ protocol: "https", hostname: r2Host, pathname: "/**" });
}

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
    remotePatterns,
  },
};

export default nextConfig;
