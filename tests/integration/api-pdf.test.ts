import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/pdf/generate/route';

const mockResult = {
  projectType: 'nextjs',
  language: 'typescript',
  score: { security: 85, performance: 80 },
  issues: [
    {
      id: '1',
      category: 'security',
      severity: 'critical',
      title: 'SQL Injection',
      explanation: 'User input not sanitized',
      location: 'src/db.ts:10',
      badCode: 'db.query(`SELECT * FROM users WHERE id = ${id}`)',
      fix: 'db.query("SELECT * FROM users WHERE id = $1", [id])',
    },
    {
      id: '2',
      category: 'performance',
      severity: 'warning',
      title: 'N+1 Query',
      explanation: 'Multiple queries in loop',
    },
  ],
  summary: 'Found critical security issues.',
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/pdf/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/pdf/generate', () => {
  it('returns PDF with correct content type', async () => {
    const res = await POST(makeRequest({ reviewResult: mockResult }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('includes sanitized filename in Content-Disposition', async () => {
    const res = await POST(makeRequest({ reviewResult: mockResult }));
    const disposition = res.headers.get('Content-Disposition')!;
    expect(disposition).toContain('vibeshomer-report-nextjs-');
    expect(disposition).toContain('.pdf');
  });

  it('returns 400 for missing reviewResult', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 413 when content-length exceeds 100KB', async () => {
    const req = new Request('http://localhost:3000/api/pdf/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(200 * 1024),
      },
      body: JSON.stringify({ reviewResult: mockResult }),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('truncates issues array to 50', async () => {
    const manyIssues = Array.from({ length: 60 }, (_, i) => ({
      id: String(i),
      category: 'security',
      severity: 'info',
      title: `Issue ${i}`,
      explanation: `Description ${i}`,
    }));

    const res = await POST(makeRequest({
      reviewResult: { ...mockResult, issues: manyIssues },
    }));
    expect(res.status).toBe(200);
  });

  it('handles result with no issues', async () => {
    const res = await POST(makeRequest({
      reviewResult: { ...mockResult, issues: [] },
    }));
    expect(res.status).toBe(200);
  });

  it('sanitizes projectType in filename', async () => {
    const res = await POST(makeRequest({
      reviewResult: { ...mockResult, projectType: 'next/../evil' },
    }));
    const disposition = res.headers.get('Content-Disposition')!;
    expect(disposition).not.toContain('..');
    expect(disposition).not.toContain('/');
  });
});
