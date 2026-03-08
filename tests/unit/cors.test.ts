import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cors', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeReq(origin: string): Request {
    return new Request('http://localhost:3000/api/test', {
      headers: { origin },
    });
  }

  it('allows vibeshomer.dev origin', async () => {
    const { corsHeaders } = await import('@/lib/cors');
    const headers = corsHeaders(makeReq('https://vibeshomer.dev'));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://vibeshomer.dev');
  });

  it('allows www.vibeshomer.dev origin', async () => {
    const { corsHeaders } = await import('@/lib/cors');
    const headers = corsHeaders(makeReq('https://www.vibeshomer.dev'));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://www.vibeshomer.dev');
  });

  it('allows .vercel.app origins', async () => {
    const { corsHeaders } = await import('@/lib/cors');
    const headers = corsHeaders(makeReq('https://my-app.vercel.app'));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://my-app.vercel.app');
  });

  it('allows any origin in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { corsHeaders } = await import('@/lib/cors');
    const headers = corsHeaders(makeReq('http://localhost:3000'));
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('blocks unknown origins in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { corsHeaders } = await import('@/lib/cors');
    const headers = corsHeaders(makeReq('https://evil.com'));
    expect(headers['Access-Control-Allow-Origin']).toBe('');
  });

  it('includes correct methods and headers', async () => {
    const { corsHeaders } = await import('@/lib/cors');
    const headers = corsHeaders(makeReq('https://vibeshomer.dev'));
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type');
  });
});
