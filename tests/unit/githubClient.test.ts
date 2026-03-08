import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseGithubUrl, fetchFileTree, fetchFileContent, fetchMultipleFiles } from '@/lib/githubClient';

describe('parseGithubUrl', () => {
  it('parses standard GitHub URL', () => {
    expect(parseGithubUrl('https://github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('strips .git suffix', () => {
    expect(parseGithubUrl('https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('handles URL with trailing path segments', () => {
    const result = parseGithubUrl('https://github.com/owner/repo/tree/main/src');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('handles URL with query params and hash', () => {
    expect(parseGithubUrl('https://github.com/o/r?tab=code#readme')).toEqual({ owner: 'o', repo: 'r' });
  });

  it('returns null for non-GitHub URL', () => {
    expect(parseGithubUrl('https://gitlab.com/owner/repo')).toBeNull();
  });

  it('returns null for invalid characters in owner', () => {
    expect(parseGithubUrl('https://github.com/ow ner/repo')).toBeNull();
  });

  it('returns null for owner being "."', () => {
    expect(parseGithubUrl('https://github.com/./repo')).toBeNull();
  });

  it('returns null for repo being ".."', () => {
    expect(parseGithubUrl('https://github.com/owner/..')).toBeNull();
  });

  it('allows hyphens, underscores, and dots', () => {
    expect(parseGithubUrl('https://github.com/my-org/my.repo_v2')).toEqual({
      owner: 'my-org',
      repo: 'my.repo_v2',
    });
  });

  it('returns null for empty string', () => {
    expect(parseGithubUrl('')).toBeNull();
  });
});

describe('fetchFileTree', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns blob paths from tree response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tree: [
          { path: 'src/index.ts', type: 'blob' },
          { path: 'src', type: 'tree' },
          { path: 'package.json', type: 'blob' },
        ],
      }),
    }));

    const result = await fetchFileTree('owner', 'repo');
    expect(result).toEqual(['src/index.ts', 'package.json']);
  });

  it('throws on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchFileTree('owner', 'repo')).rejects.toThrow('Repository not found');
  });

  it('throws on 403 (rate limited)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(fetchFileTree('owner', 'repo')).rejects.toThrow('rate limited');
  });

  it('throws generic error for other status codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchFileTree('owner', 'repo')).rejects.toThrow('GitHub API error: 500');
  });

  it('adds Authorization header when token provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tree: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchFileTree('owner', 'repo', 'test-token');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer test-token');
  });
});

describe('fetchFileContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns text content on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '100' }),
      text: async () => 'file content here',
    }));

    const result = await fetchFileContent('owner', 'repo', 'src/index.ts');
    expect(result).toBe('file content here');
  });

  it('returns empty string on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      headers: new Headers(),
    }));

    const result = await fetchFileContent('owner', 'repo', 'missing.ts');
    expect(result).toBe('');
  });

  it('returns empty string when content-length exceeds 100KB', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': String(200 * 1024) }),
      text: async () => 'should not be read',
    }));

    const result = await fetchFileContent('owner', 'repo', 'large.bin');
    expect(result).toBe('');
  });

  it('returns empty string when text exceeds 100KB', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () => 'x'.repeat(101 * 1024),
    }));

    const result = await fetchFileContent('owner', 'repo', 'large.txt');
    expect(result).toBe('');
  });
});

describe('fetchMultipleFiles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches files and filters out empty content', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 2) return { ok: false, headers: new Headers() };
      return {
        ok: true,
        headers: new Headers({ 'content-length': '50' }),
        text: async () => `content-${callCount}`,
      };
    }));

    const result = await fetchMultipleFiles('owner', 'repo', ['a.ts', 'b.ts', 'c.ts']);
    expect(result.length).toBe(2);
    expect(result.every(f => f.content.length > 0)).toBe(true);
  });

  it('processes in batches of 5', async () => {
    const fetchCalls: number[][] = [];
    let batchStartTimes: number[] = [];
    let callCount = 0;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        headers: new Headers({ 'content-length': '10' }),
        text: async () => 'content',
      };
    }));

    const paths = Array.from({ length: 7 }, (_, i) => `file${i}.ts`);
    await fetchMultipleFiles('owner', 'repo', paths);
    expect(callCount).toBe(7);
  });
});
