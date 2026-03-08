import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { REQUIRED_PROMPT_VARS } from '@/lib/promptBuilder';

// All supported project types and their corresponding env var suffixes
const FRAMEWORKS: Record<string, string> = {
  nextjs: 'NEXTJS',
  express: 'EXPRESS',
  django: 'DJANGO',
  fastapi: 'FASTAPI',
  rails: 'RAILS',
  go: 'GO',
  'generic-js': 'GENERIC_JS',
  'generic-python': 'GENERIC_PYTHON',
};

function stubAllPrompts(overrides: Record<string, string> = {}) {
  vi.stubEnv('PROMPT_SYSTEM', overrides['PROMPT_SYSTEM'] ?? 'System prompt');
  vi.stubEnv('PROMPT_OUTPUT_FORMAT', overrides['PROMPT_OUTPUT_FORMAT'] ?? 'Output format');

  for (const [, suffix] of Object.entries(FRAMEWORKS)) {
    const secKey = `PROMPT_SECURITY_${suffix}`;
    const perfKey = `PROMPT_PERFORMANCE_${suffix}`;
    vi.stubEnv(secKey, overrides[secKey] ?? `Security checklist for ${suffix}`);
    vi.stubEnv(perfKey, overrides[perfKey] ?? `Performance checklist for ${suffix}`);
  }
}

describe('buildPrompt', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes PROMPT_SYSTEM at the beginning', async () => {
    stubAllPrompts({ PROMPT_SYSTEM: 'You are a security scanner.' });
    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('generic-js', 'code');
    expect(result).toContain('You are a security scanner.');
  });

  it('includes PROMPT_OUTPUT_FORMAT', async () => {
    stubAllPrompts({ PROMPT_OUTPUT_FORMAT: 'Return valid JSON.' });
    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('generic-js', 'code');
    expect(result).toContain('Return valid JSON.');
  });

  it('includes the code after separator', async () => {
    stubAllPrompts();
    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('generic-js', 'const x = 1;');
    expect(result).toContain('--- CODE TO ANALYZE ---');
    expect(result).toContain('const x = 1;');
  });

  it('code appears after all prompt sections', async () => {
    stubAllPrompts();
    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('generic-js', 'MY_CODE_HERE');
    const separatorIdx = result.indexOf('--- CODE TO ANALYZE ---');
    const codeIdx = result.indexOf('MY_CODE_HERE');
    expect(separatorIdx).toBeGreaterThan(0);
    expect(codeIdx).toBeGreaterThan(separatorIdx);
  });

  // Test every framework uses its own security + performance prompts
  for (const [projectType, suffix] of Object.entries(FRAMEWORKS)) {
    it(`uses PROMPT_SECURITY_${suffix} for ${projectType}`, async () => {
      const secKey = `PROMPT_SECURITY_${suffix}`;
      stubAllPrompts({ [secKey]: `UNIQUE_SEC_${suffix}` });
      const { buildPrompt } = await import('@/lib/promptBuilder');
      const result = buildPrompt(projectType, 'code');
      expect(result).toContain(`UNIQUE_SEC_${suffix}`);
    });

    it(`uses PROMPT_PERFORMANCE_${suffix} for ${projectType}`, async () => {
      const perfKey = `PROMPT_PERFORMANCE_${suffix}`;
      stubAllPrompts({ [perfKey]: `UNIQUE_PERF_${suffix}` });
      const { buildPrompt } = await import('@/lib/promptBuilder');
      const result = buildPrompt(projectType, 'code');
      expect(result).toContain(`UNIQUE_PERF_${suffix}`);
    });

    it(`does NOT include other frameworks' prompts for ${projectType}`, async () => {
      stubAllPrompts();
      const { buildPrompt } = await import('@/lib/promptBuilder');
      const result = buildPrompt(projectType, 'code');

      for (const [otherType, otherSuffix] of Object.entries(FRAMEWORKS)) {
        if (otherType === projectType) continue;
        expect(result).not.toContain(`Security checklist for ${otherSuffix}`);
        expect(result).not.toContain(`Performance checklist for ${otherSuffix}`);
      }
    });
  }

  it('falls back to generic-js prompts for unknown project type', async () => {
    stubAllPrompts({
      PROMPT_SECURITY_GENERIC_JS: 'FALLBACK_SEC',
      PROMPT_PERFORMANCE_GENERIC_JS: 'FALLBACK_PERF',
    });
    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('nonexistent-framework', 'code');
    expect(result).toContain('FALLBACK_SEC');
    expect(result).toContain('FALLBACK_PERF');
  });

  it('filters out empty prompt sections', async () => {
    vi.stubEnv('PROMPT_SYSTEM', '');
    vi.stubEnv('PROMPT_SECURITY_GENERIC_JS', 'Check security.');
    vi.stubEnv('PROMPT_PERFORMANCE_GENERIC_JS', '');
    vi.stubEnv('PROMPT_OUTPUT_FORMAT', '');

    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('generic-js', 'code');
    expect(result).not.toMatch(/^\n/);
    expect(result).toContain('Check security.');
  });

  it('all prompt sections are joined with double newlines', async () => {
    stubAllPrompts({
      PROMPT_SYSTEM: 'SYSTEM',
      PROMPT_SECURITY_NEXTJS: 'SECURITY',
      PROMPT_PERFORMANCE_NEXTJS: 'PERFORMANCE',
      PROMPT_OUTPUT_FORMAT: 'FORMAT',
    });
    const { buildPrompt } = await import('@/lib/promptBuilder');
    const result = buildPrompt('nextjs', 'code');
    expect(result).toContain('SYSTEM\n\nSECURITY\n\nPERFORMANCE\n\nFORMAT\n\n--- CODE TO ANALYZE ---\n\ncode');
  });
});

describe('REQUIRED_PROMPT_VARS', () => {
  it('lists exactly 18 required variables', () => {
    expect(REQUIRED_PROMPT_VARS).toHaveLength(18);
  });

  it('includes PROMPT_SYSTEM and PROMPT_OUTPUT_FORMAT', () => {
    expect(REQUIRED_PROMPT_VARS).toContain('PROMPT_SYSTEM');
    expect(REQUIRED_PROMPT_VARS).toContain('PROMPT_OUTPUT_FORMAT');
  });

  it('includes security + performance for every framework', () => {
    const frameworks = ['NEXTJS', 'EXPRESS', 'DJANGO', 'FASTAPI', 'RAILS', 'GO', 'GENERIC_JS', 'GENERIC_PYTHON'];
    for (const fw of frameworks) {
      expect(REQUIRED_PROMPT_VARS).toContain(`PROMPT_SECURITY_${fw}`);
      expect(REQUIRED_PROMPT_VARS).toContain(`PROMPT_PERFORMANCE_${fw}`);
    }
  });

  it('all required prompt vars are set in the environment', () => {
    const missing = REQUIRED_PROMPT_VARS.filter((v) => !process.env[v]);
    expect(missing, `Missing env vars: ${missing.join(', ')}`).toEqual([]);
  });
});
