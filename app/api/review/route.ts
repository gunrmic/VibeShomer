import Anthropic from '@anthropic-ai/sdk';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildPrompt } from '@/lib/promptBuilder';
import { corsHeaders } from '@/lib/cors';
import { ENV } from '@/lib/env';
import { hashKey, getCached, setCache } from '@/lib/cache';

const MAX_CODE_SIZE = 50 * 1024; // 50KB
const VALID_LANGUAGES = new Set([
  'nextjs', 'express', 'django', 'fastapi', 'rails', 'go',
  'generic-js', 'generic-python', 'unknown',
]);

// Haiku for triage, Sonnet for deep analysis
const MODEL_TRIAGE = 'claude-haiku-4-5-20250514';
const MODEL_DEEP = 'claude-sonnet-4-20250514';

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
    const { code, language } = body;

    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No code provided.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (code.length > MAX_CODE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Code too large. Max 50KB.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const projectType = (typeof language === 'string' && VALID_LANGUAGES.has(language))
      ? language
      : 'generic-js';

    // Check cache first
    const cacheKey = hashKey(`review:${projectType}:${code}`);
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

    const prompt = buildPrompt(projectType, code);
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
          // Cache the deep scan result
          setCache(cacheKey, fullText);
          controller.close();
        } catch {
          console.error('[review] Stream error occurred');
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
    console.error('[review] Request error occurred');
    return new Response(
      JSON.stringify({ error: 'Analysis failed. Please try again.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}
