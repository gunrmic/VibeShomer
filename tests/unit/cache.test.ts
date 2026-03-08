import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('cache', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  async function getCache() {
    return await import('@/lib/cache');
  }

  it('hashKey produces consistent 32-char hex string', async () => {
    const { hashKey } = await getCache();
    const hash = hashKey('test-input');
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
    expect(hashKey('test-input')).toBe(hash);
  });

  it('hashKey produces different hashes for different inputs', async () => {
    const { hashKey } = await getCache();
    expect(hashKey('input-a')).not.toBe(hashKey('input-b'));
  });

  it('stores and retrieves values', async () => {
    const { getCached, setCache } = await getCache();
    setCache('key1', 'value1');
    expect(getCached('key1')).toBe('value1');
  });

  it('returns null for missing key', async () => {
    const { getCached } = await getCache();
    expect(getCached('nonexistent')).toBeNull();
  });

  it('expires entries after TTL', async () => {
    vi.useFakeTimers();
    const { getCached, setCache } = await getCache();

    setCache('expiring', 'value');
    expect(getCached('expiring')).toBe('value');

    // Advance past 1 hour TTL
    vi.advanceTimersByTime(61 * 60 * 1000);
    expect(getCached('expiring')).toBeNull();
  });

  it('evicts oldest entry when at max capacity', async () => {
    const { getCached, setCache } = await getCache();

    // Fill to capacity (500)
    for (let i = 0; i < 500; i++) {
      setCache(`key-${i}`, `value-${i}`);
    }
    expect(getCached('key-0')).toBe('value-0');

    // Add one more — should evict key-0
    setCache('key-new', 'new-value');
    expect(getCached('key-0')).toBeNull();
    expect(getCached('key-new')).toBe('new-value');
  });
});
