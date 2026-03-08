import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('buildPrompt', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes the code after separator', async () => {
    vi.stubEnv('PROMPT_SYSTEM', 'You are a scanner.');
    vi.stubEnv('PROMPT_OUTPUT_FORMAT', 'Output JSON.');
    vi.stubEnv('PROMPT_SECURITY_GENERIC_JS', 'Check XSS.');
    vi.stubEnv('PROMPT_PERFORMANCE_GENERIC_JS', 'Check perf.');

    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('generic-js', 'const x = 1;');
    expect(result).toContain('--- CODE TO ANALYZE ---');
    expect(result).toContain('const x = 1;');
  });

  it('uses framework-specific prompts for nextjs', async () => {
    vi.stubEnv('PROMPT_SYSTEM', 'System');
    vi.stubEnv('PROMPT_SECURITY_NEXTJS', 'Next security');
    vi.stubEnv('PROMPT_PERFORMANCE_NEXTJS', 'Next perf');
    vi.stubEnv('PROMPT_OUTPUT_FORMAT', 'Format');

    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('nextjs', 'code');
    expect(result).toContain('Next security');
    expect(result).toContain('Next perf');
  });

  it('falls back to generic-js for unknown project type', async () => {
    vi.stubEnv('PROMPT_SYSTEM', 'System');
    vi.stubEnv('PROMPT_SECURITY_GENERIC_JS', 'Generic JS sec');
    vi.stubEnv('PROMPT_PERFORMANCE_GENERIC_JS', 'Generic JS perf');
    vi.stubEnv('PROMPT_OUTPUT_FORMAT', 'Format');

    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('nonexistent', 'code');
    expect(result).toContain('Generic JS sec');
  });

  it('filters out empty sections', async () => {
    vi.stubEnv('PROMPT_SYSTEM', '');
    vi.stubEnv('PROMPT_SECURITY_GENERIC_JS', 'Check security.');
    vi.stubEnv('PROMPT_PERFORMANCE_GENERIC_JS', '');
    vi.stubEnv('PROMPT_OUTPUT_FORMAT', '');

    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('generic-js', 'code');
    // Should not start with empty lines
    expect(result).not.toMatch(/^\n/);
  });
});
