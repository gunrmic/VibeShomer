import Anthropic from '@anthropic-ai/sdk';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildPrompt } from '@/lib/promptBuilder';
import { detectProjectType } from '@/lib/projectDetector';
import { selectFiles, trimToTokenCap } from '@/lib/fileSelector';
import { corsHeaders } from '@/lib/cors';
import {
  parseGithubUrl,
  fetchFileTree,
  fetchMultipleFiles,
  fetchFileContent,
} from '@/lib/githubClient';

const MAX_FILE_COUNT = 200;

// GitHub tokens: classic (ghp_), fine-grained (github_pat_), or OAuth (gho_)
const GITHUB_TOKEN_RE = /^(ghp_[a-zA-Z0-9]{36,}|github_pat_[a-zA-Z0-9_]{22,}|gho_[a-zA-Z0-9]{36,})$/;

function isValidGithubToken(token: unknown): token is string {
  return typeof token === 'string' && GITHUB_TOKEN_RE.test(token);
}

const SAFE_ERRORS: Record<string, string> = {
  'Repository not found. Is it public?': 'Repository not found. Is it public?',
  'GitHub API rate limited. Try adding a personal access token.': 'GitHub API rate limited. Try adding a personal access token.',
};

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error && SAFE_ERRORS[err.message]) {
    return SAFE_ERRORS[err.message];
  }
  return 'Analysis failed. Please try again.';
}

function getClientIp(): string {
  const h = headers();
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
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
    // Validate token format before using
    const token = isValidGithubToken(githubToken)
      ? githubToken
      : process.env.GITHUB_TOKEN;

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

    // Detect project type from root files
    const detectorFiles: { path: string; content?: string }[] = [];
    const rootDetectionFiles = ['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Gemfile'];
    for (const f of rootDetectionFiles) {
      if (allFiles.includes(f)) {
        const content = await fetchFileContent(owner, repo, f, token);
        detectorFiles.push({ path: f, content });
      }
    }

    const projectType = detectProjectType(detectorFiles);

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

    const prompt = buildPrompt(projectType, codeString);

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch {
          controller.error(new Error('Stream interrupted'));
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...cors,
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: safeErrorMessage(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}
