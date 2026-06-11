// Minimal cache-store contract. Two implementations live in this folder:
//
//   • MemoryStore  — default, in-process Map. Zero deps, sub-microsecond hit
//                    latency, dies with the process (so a serverless cold
//                    start re-fills from the DB).
//   • RedisStore   — to be added when a tenant grows past one warm instance.
//                    See README in this folder for the shape — it has to
//                    implement the same three calls and nothing else.
//
// Keep this interface small on purpose: more methods would tempt callers to
// reach past `cached()` into raw store ops, and the in-flight dedup + tag
// bookkeeping that `cached()` does only works when everything goes through it.
export interface CacheStore {
  // Returns the cached value, or undefined if missing/expired. Implementations
  // MUST treat an expired entry as a miss (lazy expiration is fine — no
  // background timer required).
  get<T>(key: string): Promise<T | undefined>;

  // Replace any existing entry at `key`. `tags` are remembered so a later
  // bustTag(t) can find this entry.
  set<T>(key: string, value: T, ttlSeconds: number, tags: string[]): Promise<void>;

  // Delete every entry tagged with `tag`. No-op if no entries match.
  bustTag(tag: string): Promise<void>;
}
