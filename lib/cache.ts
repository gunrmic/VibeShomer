import { createHash } from 'crypto';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 500;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  store.forEach((entry, key) => {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  });
}

export function hashKey(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

export function getCached(key: string): string | null {
  cleanup();
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key: string, value: string): void {
  cleanup();

  // Evict oldest entries if at capacity
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }

  store.set(key, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}
