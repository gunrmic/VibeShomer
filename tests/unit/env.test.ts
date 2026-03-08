import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ENV', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ANTHROPIC_API_KEY throws when env var is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const { ENV } = await import('@/lib/env');
    expect(() => ENV.ANTHROPIC_API_KEY).toThrow('Missing required environment variable');
  });

  it('ANTHROPIC_API_KEY returns value when set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-key');
    const { ENV } = await import('@/lib/env');
    expect(ENV.ANTHROPIC_API_KEY).toBe('sk-test-key');
  });

  it('GITHUB_TOKEN returns undefined when not set', async () => {
    delete process.env.GITHUB_TOKEN;
    const { ENV } = await import('@/lib/env');
    expect(ENV.GITHUB_TOKEN).toBeUndefined();
  });

  it('GITHUB_TOKEN returns value when set', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp_testtoken123');
    const { ENV } = await import('@/lib/env');
    expect(ENV.GITHUB_TOKEN).toBe('ghp_testtoken123');
  });
});
