import { describe, it, expect } from 'vitest';
import { estimateTokens } from '@/lib/tokenEstimator';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('rounds up with Math.ceil', () => {
    expect(estimateTokens('a'.repeat(401))).toBe(101);
  });

  it('handles single character', () => {
    expect(estimateTokens('x')).toBe(1);
  });
});
