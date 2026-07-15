import path from "node:path";
import fs from "node:fs/promises";

// Public-folder images (logos / letterheads) inlined as base64 data URLs for
// @react-pdf. These files are immutable build assets, so memoise per-path: a
// warm Fluid instance then skips the disk read + base64 encode on every single
// PDF request (receipts, ID cards, timetables), which is pure CPU otherwise.
const cache = new Map<string, Promise<string>>();

export function assetDataUrl(publicRelPath: string): Promise<string> {
  const rel = publicRelPath.replace(/^\/+/, "");
  let hit = cache.get(rel);
  if (!hit) {
    hit = readAsDataUrl(rel).catch((e) => {
      cache.delete(rel); // never cache a failed read
      throw e;
    });
    cache.set(rel, hit);
  }
  return hit;
}

async function readAsDataUrl(rel: string): Promise<string> {
  const abs = path.join(process.cwd(), "public", rel);
  const bytes = await fs.readFile(abs);
  const mime = rel.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}
