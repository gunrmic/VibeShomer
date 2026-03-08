import type { ProjectType } from '@/types';
import { estimateTokens } from './tokenEstimator';

const ALWAYS_EXCLUDE = [
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  '__pycache__/',
  '.git/',
  '.vercel/',
];

const EXCLUDE_EXTENSIONS = [
  '.lock',
  '.log',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.gif',
  '.webp',
  '.mp4',
  '.mp3',
];

const EXCLUDE_PREFIXES = ['.env', 'README', 'LICENSE'];
const EXCLUDE_PATTERNS = ['.test.', '.spec.'];

const PRIORITY_PATTERNS: Record<string, string[]> = {
  nextjs: [
    'app/api/',
    'pages/api/',
    'middleware.ts',
    'middleware.js',
    'actions.ts',
    'actions.js',
    'lib/db',
    'lib/auth',
    'lib/supabase',
  ],
  express: [
    'routes/',
    'controllers/',
    'middleware/',
    'models/',
    'index.js',
    'app.js',
    'server.js',
  ],
  django: [
    'views.py',
    'models.py',
    'urls.py',
    'settings.py',
    'serializers.py',
    'permissions.py',
  ],
  fastapi: [
    'main.py',
    'routers/',
    'models.py',
    'dependencies.py',
    'config.py',
  ],
  rails: [
    'app/controllers/',
    'app/models/',
    'config/routes.rb',
    'config/application.rb',
  ],
  go: ['handler', 'middleware', 'router', 'main.go'],
  'generic-js': ['.js', '.ts', '.mjs', '.jsx', '.tsx'],
  'generic-python': ['.py'],
};

const HIGH_PRIORITY_NAMES = [
  'auth',
  'db',
  'query',
  'user',
  'payment',
  'api',
  'route',
  'model',
  'middleware',
];

const TOKEN_CAP = 6000;
const MAX_FILES_GENERIC = 15;

function shouldExclude(path: string): boolean {
  if (ALWAYS_EXCLUDE.some((ex) => path.includes(ex))) return true;
  const basename = path.split('/').pop() ?? '';
  if (EXCLUDE_EXTENSIONS.some((ext) => basename.endsWith(ext))) return true;
  if (EXCLUDE_PREFIXES.some((prefix) => basename.startsWith(prefix)))
    return true;
  if (EXCLUDE_PATTERNS.some((pat) => basename.includes(pat))) return true;
  return false;
}

function matchesPriority(path: string, patterns: string[]): boolean {
  return patterns.some(
    (pat) => path.includes(pat) || path.endsWith(pat)
  );
}

function isHighPriority(path: string): boolean {
  const lower = path.toLowerCase();
  return HIGH_PRIORITY_NAMES.some((name) => lower.includes(name));
}

export function selectFiles(
  filePaths: string[],
  projectType: ProjectType
): string[] {
  const filtered = filePaths.filter((p) => !shouldExclude(p));
  const patterns = PRIORITY_PATTERNS[projectType] ?? PRIORITY_PATTERNS['generic-js'];

  const prioritized = filtered.filter((p) => matchesPriority(p, patterns));
  const highPriority = filtered.filter(
    (p) => !prioritized.includes(p) && isHighPriority(p)
  );
  const rest = filtered.filter(
    (p) => !prioritized.includes(p) && !highPriority.includes(p)
  );

  const ordered = [...prioritized, ...highPriority, ...rest];

  const isGeneric =
    projectType === 'generic-js' ||
    projectType === 'generic-python' ||
    projectType === 'unknown';
  if (isGeneric) {
    return ordered.slice(0, MAX_FILES_GENERIC);
  }

  return ordered;
}

export function trimToTokenCap(
  files: { path: string; content: string }[]
): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = [];
  let totalTokens = 0;

  for (const file of files) {
    const tokens = estimateTokens(file.content);
    if (totalTokens + tokens > TOKEN_CAP) {
      const remaining = TOKEN_CAP - totalTokens;
      if (remaining > 100) {
        const truncated = file.content.slice(0, remaining * 4);
        result.push({ path: file.path, content: truncated + '\n// ... truncated' });
      }
      break;
    }
    totalTokens += tokens;
    result.push(file);
  }

  return result;
}
