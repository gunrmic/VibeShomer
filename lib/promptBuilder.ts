// All required PROMPT_* env var names — used by tests and CI to verify config
export const REQUIRED_PROMPT_VARS = [
  'PROMPT_SYSTEM',
  'PROMPT_OUTPUT_FORMAT',
  'PROMPT_SECURITY_NEXTJS',
  'PROMPT_PERFORMANCE_NEXTJS',
  'PROMPT_SECURITY_EXPRESS',
  'PROMPT_PERFORMANCE_EXPRESS',
  'PROMPT_SECURITY_DJANGO',
  'PROMPT_PERFORMANCE_DJANGO',
  'PROMPT_SECURITY_FASTAPI',
  'PROMPT_PERFORMANCE_FASTAPI',
  'PROMPT_SECURITY_RAILS',
  'PROMPT_PERFORMANCE_RAILS',
  'PROMPT_SECURITY_GO',
  'PROMPT_PERFORMANCE_GO',
  'PROMPT_SECURITY_GENERIC_JS',
  'PROMPT_PERFORMANCE_GENERIC_JS',
  'PROMPT_SECURITY_GENERIC_PYTHON',
  'PROMPT_PERFORMANCE_GENERIC_PYTHON',
] as const;

const PROMPTS: Record<string, { security: string; performance: string }> = {
  nextjs: {
    security: process.env.PROMPT_SECURITY_NEXTJS ?? '',
    performance: process.env.PROMPT_PERFORMANCE_NEXTJS ?? '',
  },
  express: {
    security: process.env.PROMPT_SECURITY_EXPRESS ?? '',
    performance: process.env.PROMPT_PERFORMANCE_EXPRESS ?? '',
  },
  django: {
    security: process.env.PROMPT_SECURITY_DJANGO ?? '',
    performance: process.env.PROMPT_PERFORMANCE_DJANGO ?? '',
  },
  fastapi: {
    security: process.env.PROMPT_SECURITY_FASTAPI ?? '',
    performance: process.env.PROMPT_PERFORMANCE_FASTAPI ?? '',
  },
  rails: {
    security: process.env.PROMPT_SECURITY_RAILS ?? '',
    performance: process.env.PROMPT_PERFORMANCE_RAILS ?? '',
  },
  go: {
    security: process.env.PROMPT_SECURITY_GO ?? '',
    performance: process.env.PROMPT_PERFORMANCE_GO ?? '',
  },
  'generic-js': {
    security: process.env.PROMPT_SECURITY_GENERIC_JS ?? '',
    performance: process.env.PROMPT_PERFORMANCE_GENERIC_JS ?? '',
  },
  'generic-python': {
    security: process.env.PROMPT_SECURITY_GENERIC_PYTHON ?? '',
    performance: process.env.PROMPT_PERFORMANCE_GENERIC_PYTHON ?? '',
  },
};

export function buildPrompt(projectType: string, code: string): string {
  const p = PROMPTS[projectType] ?? PROMPTS['generic-js'];
  return [
    process.env.PROMPT_SYSTEM ?? '',
    p.security,
    p.performance,
    process.env.PROMPT_OUTPUT_FORMAT ?? '',
    '--- CODE TO ANALYZE ---',
    code,
  ]
    .filter(Boolean)
    .join('\n\n');
}
