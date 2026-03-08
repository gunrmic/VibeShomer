import Anthropic from '@anthropic-ai/sdk';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildPrompt } from '@/lib/promptBuilder';

const MAX_CODE_SIZE = 50 * 1024; // 50KB

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
    const { code, language } = body;

    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No code provided.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (code.length > MAX_CODE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Code too large. Max 50KB.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const projectType = language ?? 'generic-js';
    const prompt = buildPrompt(projectType, code);

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
    console.error('Review API error:', err);
    return new Response(
      JSON.stringify({ error: 'Analysis failed. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
