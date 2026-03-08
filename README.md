# VibeShomer

Free AI-powered security & performance scanner for vibe-coded projects.

[vibeshomer.dev](https://vibeshomer.dev)

---

## What it does

VibeShomer scans your code for security vulnerabilities and performance issues using framework-specific analysis powered by Claude. It understands the patterns and pitfalls unique to each stack.

**Supported stacks:** Next.js · Express · Django · FastAPI · Rails · Go · Generic JS/TS · Generic Python

Each issue report includes:
- Severity level (critical / warning / info)
- Plain-language explanation a junior developer can understand
- The problematic code snippet
- A suggested fix
- Downloadable PDF report

## How to use

**Option 1: Paste code** — Copy your code into the textarea, select the framework, and hit analyze.

**Option 2: GitHub URL** — Enter a public repo URL and VibeShomer will fetch the relevant files automatically.

> For private repos, provide a personal access token with `repo:read` scope. The token is used in-memory only and never stored.

## Why framework-specific prompts matter

A generic "check for security issues" prompt misses most real vulnerabilities. SQL injection looks completely different in Django (`raw()` with `%s` formatting) vs Express (string-concatenated Sequelize queries). Server Actions in Next.js don't exist in Rails. VibeShomer uses tailored checklists for each framework so it catches what actually matters.

## Privacy

- Code is never stored
- GitHub tokens used only in-memory, never logged
- No login required

## Tech stack

- Next.js 14 · TypeScript · Tailwind CSS
- Claude API (claude-sonnet-4-20250514) with streaming
- Python / reportlab for PDF generation
- Deployed on Vercel

## Contributing

Issues for false positives or missing security patterns are welcome. Note that the prompt checklists are not open source (stored as environment variables) but the rest of the codebase is.

## License

MIT
