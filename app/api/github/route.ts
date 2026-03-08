import Anthropic from '@anthropic-ai/sdk';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildPrompt } from '@/lib/promptBuilder';
import { detectProjectType } from '@/lib/projectDetector';
import { selectFiles, trimToTokenCap } from '@/lib/fileSelector';
import {
  parseGithubUrl,
  fetchFileTree,
  fetchMultipleFiles,
  fetchFileContent,
} from '@/lib/githubClient';

const MAX_FILE_COUNT = 200;

export async function POST(req: Request) {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed, retryAfter } = checkRateLimit(ip);

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Slow down.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { url, githubToken } = body;

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No URL provided.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: 'Invalid GitHub URL.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { owner, repo } = parsed;
    const token = githubToken || process.env.GITHUB_TOKEN;

    // Fetch file tree
    const allFiles = await fetchFileTree(owner, repo, token);

    if (allFiles.length > MAX_FILE_COUNT) {
      return new Response(
        JSON.stringify({
          error: `Repository has ${allFiles.length} files. Max ${MAX_FILE_COUNT} for free scan.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build code string
    const codeString = trimmed
      .map((f) => `// === ${f.path} ===\n${f.content}`)
      .join('\n\n');

    const prompt = buildPrompt(projectType, codeString);

    const client = new Anthropic();

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
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.';
    console.error('GitHub API error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
