interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface FileContent {
  path: string;
  content: string;
}

const GITHUB_NAME_RE = /^[a-zA-Z0-9_.-]+$/;

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');

  // Validate owner/repo contain only safe characters
  if (!GITHUB_NAME_RE.test(owner) || !GITHUB_NAME_RE.test(repo)) return null;
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') return null;

  return { owner, repo };
}

export async function fetchFileTree(
  owner: string,
  repo: string,
  token?: string
): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'VibeShomer',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error('Repository not found. Is it public?');
    if (res.status === 403) throw new Error('GitHub API rate limited. Try adding a personal access token.');
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  const entries: TreeEntry[] = data.tree ?? [];

  return entries
    .filter((e) => e.type === 'blob')
    .map((e) => e.path);
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'VibeShomer',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers }
  );

  if (!res.ok) return '';

  // Skip files larger than 100KB to prevent memory issues
  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 100 * 1024) return '';

  // Read with size limit as fallback when Content-Length is absent
  const text = await res.text();
  if (text.length > 100 * 1024) return '';
  return text;
}

const BATCH_SIZE = 5;

export async function fetchMultipleFiles(
  owner: string,
  repo: string,
  paths: string[],
  token?: string
): Promise<FileContent[]> {
  const allFiles: FileContent[] = [];

  // Process in batches to limit concurrent memory usage
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (p) => ({
        path: p,
        content: await fetchFileContent(owner, repo, p, token),
      }))
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.content.length > 0) {
        allFiles.push(r.value);
      }
    }
  }

  return allFiles;
}
