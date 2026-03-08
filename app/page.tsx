'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CodeInput } from '@/components/CodeInput';
import { GithubInput } from '@/components/GithubInput';
import { ReviewReport } from '@/components/ReviewReport';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import type { ReviewResult } from '@/types';

type Tab = 'paste' | 'github';

function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) return fenced[1].trim();
  // Try to extract raw JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  return text;
}

const PROJECT_TYPE_MAP: Record<string, string> = {
  next: 'nextjs', 'next.js': 'nextjs', nextjs: 'nextjs',
  express: 'express', 'express.js': 'express',
  django: 'django', fastapi: 'fastapi',
  rails: 'rails', 'ruby on rails': 'rails',
  go: 'go', golang: 'go',
  node: 'express', 'node.js': 'express', nodejs: 'express',
  'generic-js': 'generic-js', javascript: 'generic-js', typescript: 'generic-js',
  'generic-python': 'generic-python', python: 'generic-python',
  database: 'generic-js', mysql: 'generic-js', postgres: 'generic-js',
  react: 'generic-js', vue: 'generic-js', angular: 'generic-js', svelte: 'generic-js',
  flask: 'generic-python', 'ruby': 'rails',
};

function normalizeProjectType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  // Direct match
  if (PROJECT_TYPE_MAP[lower]) return PROJECT_TYPE_MAP[lower];
  // Partial match
  for (const [key, value] of Object.entries(PROJECT_TYPE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return raw;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('paste');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  const handlePasteSubmit = async (code: string, language: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      const parsed = JSON.parse(extractJson(fullText)) as ReviewResult;
      parsed.projectType = normalizeProjectType(parsed.projectType) as ReviewResult['projectType'];
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSubmit = async (url: string, token?: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, githubToken: token }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      const parsed = JSON.parse(extractJson(fullText)) as ReviewResult;
      parsed.projectType = normalizeProjectType(parsed.projectType) as ReviewResult['projectType'];
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <div className="scanlines" />
      <div className="grid-bg" />

      <nav className="nav">
        <div className="nav-left">
          <Image src="/logo.png" alt="VibeShomer" width={32} height={32} className="nav-logo" />
          <span className="brand-name">VIBESHOMER</span>
          <span className="status-dot" />
          <span className="status-label">ACTIVE</span>
        </div>
        <span className="tagline">Your Vibe Guardian</span>
      </nav>

      <div className="hero">
        <Image src="/logo.png" alt="VibeShomer" width={120} height={120} className="hero-logo" priority />
        <h1 className="hero-title">VIBESHOMER</h1>
        <p className="hero-subtitle">
          AI-powered security &amp; performance scanner
        </p>
      </div>

      {!result && (
        <div className="card">
          <div className="tabs">
            <button
              className={`tab ${tab === 'paste' ? 'active' : ''}`}
              onClick={() => setTab('paste')}
            >
              PASTE CODE
            </button>
            <button
              className={`tab ${tab === 'github' ? 'active' : ''}`}
              onClick={() => setTab('github')}
            >
              GITHUB URL
            </button>
          </div>

          {tab === 'paste' ? (
            <CodeInput onSubmit={handlePasteSubmit} loading={loading} />
          ) : (
            <GithubInput onSubmit={handleGithubSubmit} loading={loading} />
          )}
        </div>
      )}

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="error-card">
          <p>{error}</p>
          <button onClick={handleReset} className="btn-secondary">
            try again
          </button>
        </div>
      )}

      {result && <ReviewReport result={result} onReset={handleReset} />}

      <footer className="footer">
        <p>&quot;watching your code so you don&apos;t have to&quot;</p>
      </footer>

      <div className="watermark">
        <Image src="/logo.png" alt="" width={300} height={300} />
      </div>
    </main>
  );
}
