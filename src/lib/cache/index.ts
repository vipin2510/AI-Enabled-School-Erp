import { MemoryStore } from "./memory";
import type { CacheStore } from "./store";

// Module-level singleton. In Next.js dev mode, route HMR can re-import this
// file multiple times; we stash the instance on `globalThis` so the cache
// survives HMR instead of getting wiped on every save.
declare global {
  var __erpCacheStore: CacheStore | undefined;
  var __erpCachePending: Map<string, Promise<unknown>> | undefined;
}

const store: CacheStore = (globalThis.__erpCacheStore ??= new MemoryStore());

// In-flight request coalescing: if two callers miss the same key at the same
// time, only one runs the loader and the other awaits the same promise. Stops
// a popular page from issuing N parallel DB queries during a stampede after
// a cold start or a bustTag.
const pending: Map<string, Promise<unknown>> =
  (globalThis.__erpCachePending ??= new Map());

// Wrap an async loader with the cache. On hit, returns the cached value
// without ever calling `loader`. On miss, calls the loader once, stores the
// result at TTL, and returns it. `tags` are passed straight through to the
// store so a later bustTag(tag) flushes everything under it.
//
// Errors are NOT cached — a failed loader leaves the cache untouched and the
// next caller retries from scratch.
export async function cached<T>(
  key: string,
  tags: string[],
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await store.get<T>(key);
  if (hit !== undefined) return hit;

  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;

  const promise = (async () => {
    try {
      const value = await loader();
      await store.set(key, value, ttlSeconds, tags);
      return value;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, promise);
  return promise;
}

// Drop every entry tagged with `tag`. Safe to call from any server context;
// idempotent if nothing matches.
export async function bustTag(tag: string): Promise<void> {
  return store.bustTag(tag);
}

// Named tag builders. Keep names structured (`s:<schoolId>:<resource>`) so a
// future "burst the whole tenant" can iterate the prefix without grepping
// every caller for tag literals.
export const tagFor = {
  classes: (schoolId: string) => `s:${schoolId}:classes`,
  feeStructures: (schoolId: string) => `s:${schoolId}:fee_structures`,
  lateFeeSettings: (schoolId: string) => `s:${schoolId}:late_fee_settings`,
  feePrintSettings: (schoolId: string) => `s:${schoolId}:fee_print_settings`,
  subjects: (schoolId: string) => `s:${schoolId}:subjects`,
  librarySettings: (schoolId: string) => `s:${schoolId}:library_settings`,
  staffAttendance: (schoolId: string, profileId: string, date: string) =>
    `s:${schoolId}:p:${profileId}:sa:${date}`,
};
