import Anthropic from '@anthropic-ai/sdk';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildPrompt } from '@/lib/promptBuilder';
import { detectProjectType } from '@/lib/projectDetector';
import { selectFiles, trimToTokenCap } from '@/lib/fileSelector';
import { corsHeaders } from '@/lib/cors';
import { ENV } from '@/lib/env';
import { hashKey, getCached, setCache } from '@/lib/cache';
import {
  parseGithubUrl,
  fetchFileTree,
  fetchMultipleFiles,
  fetchFileContent,
} from '@/lib/githubClient';

const MAX_FILE_COUNT = 200;

// Haiku for triage, Sonnet for deep analysis
const MODEL_TRIAGE = 'claude-haiku-4-5-20250514';
const MODEL_DEEP = 'claude-sonnet-4-20250514';

// GitHub tokens: classic (ghp_), fine-grained (github_pat_), or OAuth (gho_)
const GITHUB_TOKEN_RE = /^(ghp_[a-zA-Z0-9]{36,}|github_pat_[a-zA-Z0-9_]{22,}|gho_[a-zA-Z0-9]{36,})$/;

function isValidGithubToken(token: unknown): token is string {
  return typeof token === 'string' && GITHUB_TOKEN_RE.test(token);
}

async function verifyGithubToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'VibeShomer',
      },
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

function getClientIp(): string {
  const h = headers();
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function hasCriticalIssues(text: string): boolean {
  try {
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return false;
    const data = JSON.parse(jsonStr);
    const issues = data.issues ?? [];
    return issues.some(
      (i: { severity?: string }) =>
        i.severity === 'critical' || i.severity === 'high'
    );
  } catch {
    return false;
  }
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const ip = getClientIp();
  const { allowed, retryAfter } = checkRateLimit(ip);

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Slow down.' }),
      {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
      }
    );
  }

  try {
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { url, githubToken } = body;

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No URL provided.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: 'Invalid GitHub URL.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { owner, repo } = parsed;

    // Validate and verify user-provided token before using it
    let token = ENV.GITHUB_TOKEN;
    if (isValidGithubToken(githubToken)) {
      const valid = await verifyGithubToken(githubToken);
      if (valid) {
        token = githubToken;
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid GitHub token. Check your token and try again.' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch file tree
    const allFiles = await fetchFileTree(owner, repo, token);

    if (allFiles.length > MAX_FILE_COUNT) {
      return new Response(
        JSON.stringify({
          error: `Repository has too many files. Max ${MAX_FILE_COUNT} for free scan.`,
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Detect project type — fetch root detection files in parallel
    const rootDetectionFiles = ['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Gemfile'];
    const detectorResults = await Promise.all(
      rootDetectionFiles
        .filter((f) => allFiles.includes(f))
        .map(async (f) => ({
          path: f,
          content: await fetchFileContent(owner, repo, f, token),
        }))
    );

    const projectType = detectProjectType(detectorResults);

    // Select relevant files
    const selectedPaths = selectFiles(allFiles, projectType);

    // Fetch file contents
    const filesWithContent = await fetchMultipleFiles(
      owner,
      repo,
      selectedPaths.slice(0, 30),
      token
    );

    // Trim to token cap
    const trimmed = trimToTokenCap(filesWithContent);

    if (trimmed.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No analyzable files found in repository.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Build code string
    const codeString = trimmed
      .map((f) => `// === ${f.path} ===\n${f.content}`)
      .join('\n\n');

    // Check cache — key by repo + code content hash
    const cacheKey = hashKey(`github:${owner}/${repo}:${projectType}:${codeString}`);
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          ...cors,
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Cache': 'HIT',
        },
      });
    }

    const prompt = buildPrompt(projectType, codeString);
    const apiKey = ENV.ANTHROPIC_API_KEY;
    const client = new Anthropic({ apiKey });

    // Phase 1: Haiku triage (fast + cheap)
    const triageResult = await client.messages.create({
      model: MODEL_TRIAGE,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const triageText = triageResult.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // If no critical/high issues, return Haiku result directly
    if (!hasCriticalIssues(triageText)) {
      setCache(cacheKey, triageText);
      return new Response(triageText, {
        headers: {
          ...cors,
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Cache': 'MISS',
          'X-Model': 'triage',
        },
      });
    }

    // Phase 2: Critical issues found — deep scan with Sonnet (streamed)
    const stream = await client.messages.stream({
      model: MODEL_DEEP,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const encoder = new TextEncoder();
    let fullText = '';
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              fullText += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          setCache(cacheKey, fullText);
          controller.close();
        } catch {
          console.error('[github] Stream error occurred');
          stream.abort();
          controller.error(new Error('Stream interrupted'));
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...cors,
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Cache': 'MISS',
        'X-Model': 'deep',
      },
    });
  } catch {
    console.error('[github] Request error occurred');
    return new Response(
      JSON.stringify({ error: 'Analysis failed. Please try again.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}
