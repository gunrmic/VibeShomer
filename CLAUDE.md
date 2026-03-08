# VibeShomer — AI Security & Performance Scanner

## Project overview

Next.js 14 App Router application that scans code for security and performance issues using Claude API. Users paste code or provide a GitHub repo URL, and the app returns severity-graded issues with fix prompts.

## Tech stack

- **Framework:** Next.js 14 (App Router) with TypeScript (strict mode)
- **Styling:** Tailwind CSS + custom CSS variables (dark cyberpunk theme in `app/globals.css`)
- **AI:** Anthropic Claude SDK (`@anthropic-ai/sdk`) — Haiku for triage, Sonnet for deep scans
- **PDF:** jsPDF for report generation
- **Deployment:** Vercel
- **Package manager:** yarn (not npm)

## Commands

```bash
yarn dev          # Start dev server (http://localhost:3000)
yarn build        # Production build — always run after changes to verify
yarn start        # Start production server
yarn lint         # Run ESLint (next lint)
yarn test         # Run unit + integration tests (vitest)
yarn test:watch   # Run tests in watch mode
yarn test:e2e     # Run Playwright E2E tests (needs dev server)
yarn test:e2e:ui  # Run E2E tests with Playwright UI
```

## Lint, type checking & testing

- ESLint config: `.eslintrc.json` extends `next/core-web-vitals` and `next/typescript`
- Run `yarn lint` before committing to catch issues
- Run `yarn build` to catch TypeScript errors (strict mode enabled)
- Run `yarn test` to run all unit and integration tests
- Run `yarn test:e2e` for end-to-end browser tests
- CI runs all checks on push/PR via `.github/workflows/ci.yml` — lint, build, unit/integration tests, then E2E

### Test structure
```
tests/
  setup.ts                  # Testing library setup
  unit/                     # Pure function tests (lib/)
  integration/              # API route handler tests
  e2e/                      # Playwright browser tests
```

### Testing conventions
- **Unit tests** (vitest): Test pure functions in `lib/` directly. Use `vi.resetModules()` + dynamic `import()` for modules with module-level state (cache, rateLimit)
- **Integration tests** (vitest): Import route handlers directly, mock `@anthropic-ai/sdk` with a class-based mock, mock `next/headers`
- **E2E tests** (Playwright): Mock API responses via `page.route()` — no real API calls needed. Tests run against `yarn dev`
- Use `vi.useFakeTimers()` for time-dependent tests (TTL, rate windows)
- Mock Anthropic SDK with class syntax (not `vi.fn().mockImplementation`) to avoid vitest warnings

## Project structure

```
app/
  api/
    github/route.ts      # GitHub repo scan endpoint (POST)
    review/route.ts      # Paste code scan endpoint (POST)
    pdf/generate/route.ts # PDF report generation (POST)
  page.tsx               # Main UI (client component)
  layout.tsx             # Root layout (Space Mono + Syne fonts)
  globals.css            # Full design system
components/              # React client components
lib/                     # Server-side utilities
types/index.ts           # Shared TypeScript types
```

## Architecture

### Dual-phase analysis (cost optimization)
1. **Haiku triage** — Every scan runs through `claude-haiku-4-5` first (~10x cheaper)
2. **Sonnet deep scan** — Only triggered if Haiku finds critical/high severity issues
3. **Caching** — Results cached in-memory by content hash (1hr TTL, 500 entry cap)

### API routes
- All API routes are in `app/api/` using Next.js App Router conventions
- Routes export `POST` and `OPTIONS` (CORS preflight) handler functions
- Streaming responses use `ReadableStream` with `TextEncoder`
- Rate limiting: 10 requests/minute per IP (`lib/rateLimit.ts`)

### Key patterns
- Path alias: `@/*` maps to project root (e.g., `import { ENV } from '@/lib/env'`)
- Environment variables validated at startup via `lib/env.ts`
- CORS allowlist in `lib/cors.ts` (localhost, vibeshomer.dev, *.vercel.app)
- GitHub token validation: format regex + verification API call before use
- Prompts stored in `.env.local` as `PROMPT_*` variables, never committed

## Environment variables

Required:
- `ANTHROPIC_API_KEY` — Claude API key

Optional:
- `GITHUB_TOKEN` — For GitHub API rate limits
- `PROMPT_SYSTEM`, `PROMPT_SECURITY_*`, `PROMPT_PERFORMANCE_*`, `PROMPT_OUTPUT_FORMAT` — Scan prompts per framework

## Security considerations

- CSP headers configured in `next.config.mjs` — no unsafe-inline/eval
- Never log error details that might contain tokens or user code
- GitHub tokens validated with regex + API verification before use
- File size limits enforced (50KB paste, 100KB per GitHub file)
- Rate limiter has store size cap (10K) to prevent memory exhaustion
- All user input validated before processing

## Code style

- Use `catch {}` (bare catch) when error details aren't needed — avoids unused variable warnings
- Arrow functions preferred inside route handlers
- `Promise.allSettled` for batch operations that shouldn't fail entirely
- `store.forEach()` instead of `for...of` on Maps (avoids downlevelIteration)
