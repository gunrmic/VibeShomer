import Anthropic from '@anthropic-ai/sdk';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildPrompt } from '@/lib/promptBuilder';
import { corsHeaders } from '@/lib/cors';
import { ENV } from '@/lib/env';

const MAX_CODE_SIZE = 50 * 1024; // 50KB
const VALID_LANGUAGES = new Set([
  'nextjs', 'express', 'django', 'fastapi', 'rails', 'go',
  'generic-js', 'generic-python', 'unknown',
]);

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
    const prompt = buildPrompt(projectType, code);

    const apiKey = ENV.ANTHROPIC_API_KEY;
    const client = new Anthropic({ apiKey });

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
