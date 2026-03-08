import { describe, it, expect } from 'vitest';
import { selectFiles, trimToTokenCap } from '@/lib/fileSelector';

describe('selectFiles', () => {
  it('excludes node_modules paths', () => {
    const files = ['src/index.ts', 'node_modules/lodash/index.js'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('excludes .next directory', () => {
    const files = ['src/index.ts', '.next/cache/build.js'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('excludes .git directory', () => {
    const files = ['src/index.ts', '.git/config'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('excludes .lock extension files', () => {
    const files = ['src/index.ts', 'yarn.lock', 'composer.lock'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('excludes image files', () => {
    const files = ['src/index.ts', 'logo.png', 'icon.svg', 'photo.jpg'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('excludes .env files', () => {
    const files = ['src/index.ts', '.env', '.env.local'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('excludes README and LICENSE', () => {
    const files = ['src/index.ts', 'README.md', 'LICENSE'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('excludes test and spec files', () => {
    const files = ['src/index.ts', 'src/utils.test.ts', 'src/utils.spec.ts'];
    expect(selectFiles(files, 'nextjs')).toEqual(['src/index.ts']);
  });

  it('prioritizes app/api/ paths for nextjs', () => {
    const files = ['utils/helper.ts', 'app/api/route.ts', 'lib/db.ts'];
    const result = selectFiles(files, 'nextjs');
    expect(result[0]).toBe('app/api/route.ts');
  });

  it('prioritizes high-priority names like auth, db, payment', () => {
    const files = ['utils/format.ts', 'lib/auth.ts', 'lib/payment.ts', 'src/index.ts'];
    const result = selectFiles(files, 'nextjs');
    const authIdx = result.indexOf('lib/auth.ts');
    const formatIdx = result.indexOf('utils/format.ts');
    expect(authIdx).toBeLessThan(formatIdx);
  });

  it('caps generic projects at 15 files', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`);
    const result = selectFiles(files, 'generic-js');
    expect(result.length).toBe(15);
  });

  it('caps unknown projects at 15 files', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`);
    const result = selectFiles(files, 'unknown');
    expect(result.length).toBe(15);
  });

  it('does not cap nextjs projects', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`);
    const result = selectFiles(files, 'nextjs');
    expect(result.length).toBe(20);
  });
});

describe('trimToTokenCap', () => {
  it('includes all files within token cap', () => {
    const files = [
      { path: 'a.ts', content: 'a'.repeat(100) },
      { path: 'b.ts', content: 'b'.repeat(100) },
    ];
    const result = trimToTokenCap(files);
    expect(result.length).toBe(2);
  });

  it('truncates file that exceeds remaining cap', () => {
    const files = [
      { path: 'a.ts', content: 'a'.repeat(20000) }, // 5000 tokens
      { path: 'b.ts', content: 'b'.repeat(8000) },  // 2000 tokens - exceeds cap
    ];
    const result = trimToTokenCap(files);
    expect(result.length).toBe(2);
    expect(result[1].content).toContain('// ... truncated');
  });

  it('drops file when remaining tokens < 100', () => {
    const files = [
      { path: 'a.ts', content: 'a'.repeat(23600) }, // 5900 tokens
      { path: 'b.ts', content: 'b'.repeat(800) },   // 200 tokens - remaining is ~100
    ];
    const result = trimToTokenCap(files);
    // Second file should be dropped since remaining (100) is not > 100
    expect(result.length).toBe(1);
  });

  it('returns empty array for empty input', () => {
    expect(trimToTokenCap([])).toEqual([]);
  });
});
