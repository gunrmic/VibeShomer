const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  'https://vibeshomer.dev',
  'https://www.vibeshomer.dev',
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.has(origin) ||
    origin.endsWith('.vercel.app') ||
    process.env.NODE_ENV === 'development';

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
