import type { CacheStore } from "./store";

// Soft cap on how many entries the store may hold at once. Far above any
// realistic working set (a handful of helpers × N schools × a few argument
// combos), but bounded so a runaway key generator can't OOM the lambda.
const MAX_ENTRIES = 1000;

type Entry = {
  value: unknown;
  // Wall-clock ms when the entry becomes stale. Read-time miss if `Date.now()`
  // has passed it.
  expiresAt: number;
  // Every tag this entry was set with — kept here so deleting one tag can
  // walk back to its keys without scanning every entry.
  tags: string[];
};

// In-process LRU-ish TTL cache. "Local" in the strictest sense: each Node
// process / serverless lambda holds its own copy. That makes invalidations
// from one instance invisible to siblings — fine for a single-instance
// deployment, a known limitation for multi-instance ones (swap RedisStore
// in then; the contract is the same).
export class MemoryStore implements CacheStore {
  private values = new Map<string, Entry>();
  // Reverse index: tag → set of keys that carry it. Built up at write time so
  // bustTag is O(|matching keys|) instead of O(|cache|).
  private tagIndex = new Map<string, Set<string>>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      // Lazy expiration: drop on read. Avoids a setInterval hanging on to
      // the process during serverless shutdown.
      this.removeEntry(key, entry);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number, tags: string[]): Promise<void> {
    // Replacing an entry: tear down the prior tag pointers first so we don't
    // leave dangling references in tagIndex.
    const prior = this.values.get(key);
    if (prior) this.removeFromTagIndex(key, prior.tags);

    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      tags,
    });
    for (const tag of tags) {
      let set = this.tagIndex.get(tag);
      if (!set) {
        set = new Set();
        this.tagIndex.set(tag, set);
      }
      set.add(key);
    }

    if (this.values.size > MAX_ENTRIES) this.evictOldest();
  }

  async bustTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) return;
    // Copy to a static list so the deletes below can mutate tagIndex safely.
    for (const key of [...keys]) {
      const entry = this.values.get(key);
      if (entry) this.removeEntry(key, entry);
    }
    this.tagIndex.delete(tag);
  }

  private removeEntry(key: string, entry: Entry) {
    this.values.delete(key);
    this.removeFromTagIndex(key, entry.tags);
  }

  private removeFromTagIndex(key: string, tags: string[]) {
    for (const tag of tags) {
      const set = this.tagIndex.get(tag);
      if (!set) continue;
      set.delete(key);
      if (set.size === 0) this.tagIndex.delete(tag);
    }
  }

  // Cheap eviction: sweep expired first, then drop the oldest insertion
  // order if still over the cap. Map iteration order = insertion order.
  private evictOldest() {
    const now = Date.now();
    for (const [key, entry] of this.values) {
      if (entry.expiresAt < now) this.removeEntry(key, entry);
      if (this.values.size <= MAX_ENTRIES) return;
    }
    while (this.values.size > MAX_ENTRIES) {
      const firstKey = this.values.keys().next().value;
      if (firstKey === undefined) break;
      const entry = this.values.get(firstKey);
      if (entry) this.removeEntry(firstKey, entry);
    }
  }
}
