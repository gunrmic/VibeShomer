import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: () => new Headers([['x-real-ip', '127.0.0.1']]),
}));

// Mock Anthropic SDK
const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        stream: mockStream,
      };
    },
  };
});

// Mock env
vi.mock('@/lib/env', () => ({
  ENV: {
    get ANTHROPIC_API_KEY() { return 'test-api-key'; },
    get GITHUB_TOKEN() { return undefined; },
  },
}));

// Mock GitHub client
vi.mock('@/lib/githubClient', () => ({
  parseGithubUrl: vi.fn((url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }),
  fetchFileTree: vi.fn(),
  fetchFileContent: vi.fn(),
  fetchMultipleFiles: vi.fn(),
}));

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no URL provided', async () => {
    const { POST } = await import('@/app/api/github/route');
    const res = await POST(makeRequest({ url: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid GitHub URL', async () => {
    const { POST } = await import('@/app/api/github/route');
    const res = await POST(makeRequest({ url: 'https://gitlab.com/owner/repo' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid GitHub URL');
  });

  it('returns 400 when repo has too many files', async () => {
    const { fetchFileTree } = await import('@/lib/githubClient');
    (fetchFileTree as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 201 }, (_, i) => `file${i}.ts`)
    );

    const { POST } = await import('@/app/api/github/route');
    const res = await POST(makeRequest({ url: 'https://github.com/owner/repo' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too many files');
  });

  it('returns 400 when no analyzable files found', async () => {
    const { fetchFileTree, fetchMultipleFiles } = await import('@/lib/githubClient');
    (fetchFileTree as ReturnType<typeof vi.fn>).mockResolvedValue(['file.ts']);
    (fetchMultipleFiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { POST } = await import('@/app/api/github/route');
    const res = await POST(makeRequest({ url: 'https://github.com/owner/repo' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No analyzable files');
  });

  it('returns triage result for successful scan', async () => {
    const { fetchFileTree, fetchMultipleFiles, fetchFileContent } = await import('@/lib/githubClient');
    (fetchFileTree as ReturnType<typeof vi.fn>).mockResolvedValue(['index.ts', 'package.json']);
    (fetchFileContent as ReturnType<typeof vi.fn>).mockResolvedValue('{"dependencies":{"next":"14"}}');
    (fetchMultipleFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { path: 'index.ts', content: 'const x = 1;' },
    ]);

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"issues":[],"score":{"security":90,"performance":90},"summary":"Clean"}' }],
    });

    const { POST } = await import('@/app/api/github/route');
    const res = await POST(makeRequest({ url: 'https://github.com/owner/repo' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Model')).toBe('triage');
  });

  it('returns 204 for OPTIONS request', async () => {
    const { OPTIONS } = await import('@/app/api/github/route');
    const req = new Request('http://localhost:3000/api/github', { method: 'OPTIONS' });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
  });
});
