import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  async function getRateLimit() {
    return await import('@/lib/rateLimit');
  }

  it('allows first request from an IP', async () => {
    const { checkRateLimit } = await getRateLimit();
    expect(checkRateLimit('1.2.3.4')).toEqual({ allowed: true });
  });

  it('allows up to 10 requests within the window', async () => {
    const { checkRateLimit } = await getRateLimit();
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('10.0.0.1').allowed).toBe(true);
    }
  });

  it('blocks 11th request within window', async () => {
    const { checkRateLimit } = await getRateLimit();
    for (let i = 0; i < 10; i++) {
      checkRateLimit('10.0.0.2');
    }
    const result = checkRateLimit('10.0.0.2');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('resets after window expires', async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await getRateLimit();

    for (let i = 0; i < 10; i++) {
      checkRateLimit('10.0.0.3');
    }
    expect(checkRateLimit('10.0.0.3').allowed).toBe(false);

    // Advance past 60s window
    vi.advanceTimersByTime(61 * 1000);
    expect(checkRateLimit('10.0.0.3').allowed).toBe(true);
  });

  it('tracks different IPs independently', async () => {
    const { checkRateLimit } = await getRateLimit();
    for (let i = 0; i < 10; i++) {
      checkRateLimit('10.0.0.4');
    }
    expect(checkRateLimit('10.0.0.4').allowed).toBe(false);
    expect(checkRateLimit('10.0.0.5').allowed).toBe(true);
  });

  it('retryAfter is roughly the remaining seconds in window', async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await getRateLimit();

    for (let i = 0; i < 10; i++) {
      checkRateLimit('10.0.0.6');
    }

    // Advance 30s into the 60s window
    vi.advanceTimersByTime(30 * 1000);
    const result = checkRateLimit('10.0.0.6');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeLessThanOrEqual(30);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
