interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface FileContent {
  path: string;
  content: string;
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/\s#?]+)/,
  ];
  for (const pat of patterns) {
    const match = url.match(pat);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
  }
  return null;
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
  return res.text();
}

export async function fetchMultipleFiles(
  owner: string,
  repo: string,
  paths: string[],
  token?: string
): Promise<FileContent[]> {
  const results = await Promise.allSettled(
    paths.map(async (p) => ({
      path: p,
      content: await fetchFileContent(owner, repo, p, token),
    }))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<FileContent> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((f) => f.content.length > 0);
}
