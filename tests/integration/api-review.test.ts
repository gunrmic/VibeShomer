import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/headers before any imports
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

function makeRequest(body: Record<string, unknown>, contentType = 'application/json'): Request {
  return new Request('http://localhost:3000/api/review', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: JSON.stringify(body),
  });
}

describe('POST /api/review', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 400 when no code provided', async () => {
    const { POST } = await import('@/app/api/review/route');
    const res = await POST(makeRequest({ code: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No code');
  });

  it('returns 400 when code exceeds 50KB', async () => {
    const { POST } = await import('@/app/api/review/route');
    const res = await POST(makeRequest({ code: 'x'.repeat(51 * 1024) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('50KB');
  });

  it('returns 400 for invalid content type', async () => {
    const { POST } = await import('@/app/api/review/route');
    const req = new Request('http://localhost:3000/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns triage result when no critical issues', async () => {
    const triageResponse = JSON.stringify({
      projectType: 'generic-js',
      score: { security: 90, performance: 85 },
      issues: [{ id: '1', severity: 'info', category: 'security', title: 'Minor issue', explanation: 'test' }],
      summary: 'Code looks good',
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: triageResponse }],
    });

    const { POST } = await import('@/app/api/review/route');
    const res = await POST(makeRequest({ code: 'const x = 1;', language: 'generic-js' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Model')).toBe('triage');
    const text = await res.text();
    expect(text).toContain('Code looks good');
  });

  it('escalates to deep scan when critical issues found', async () => {
    const triageResponse = JSON.stringify({
      projectType: 'generic-js',
      score: { security: 40, performance: 85 },
      issues: [{ id: '1', severity: 'critical', category: 'security', title: 'SQL Injection', explanation: 'test' }],
      summary: 'Critical issues found',
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: triageResponse }],
    });

    // Mock streaming for deep scan
    const mockEvents = [
      { type: 'content_block_delta', delta: { type: 'text_delta', text: '{"result":' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: '"deep"}' } },
    ];

    mockStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      },
      abort: vi.fn(),
    });

    const { POST } = await import('@/app/api/review/route');
    const res = await POST(makeRequest({ code: 'const x = 1;', language: 'generic-js' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Model')).toBe('deep');
  });

  it('returns 204 for OPTIONS request', async () => {
    const { OPTIONS } = await import('@/app/api/review/route');
    const req = new Request('http://localhost:3000/api/review', { method: 'OPTIONS' });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
  });

  it('defaults to generic-js for invalid language', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"issues":[],"score":{"security":90,"performance":90},"summary":"ok"}' }],
    });

    const { POST } = await import('@/app/api/review/route');
    await POST(makeRequest({ code: 'const x = 1;', language: 'invalid-lang' }));

    // Should succeed without error
    expect(mockCreate).toHaveBeenCalled();
  });
});
