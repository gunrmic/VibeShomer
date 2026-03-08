import type { ProjectType } from '@/types';

interface FileEntry {
  path: string;
  content?: string;
}

export function detectProjectType(files: FileEntry[]): ProjectType {
  const rootFiles = new Set(files.map((f) => f.path.split('/')[0]));
  const getContent = (name: string) =>
    files.find((f) => f.path === name)?.content ?? '';

  if (rootFiles.has('package.json')) {
    const pkg = getContent('package.json');
    if (pkg.includes('"next"')) return 'nextjs';
    if (pkg.includes('"express"')) return 'express';
    return 'generic-js';
  }

  if (rootFiles.has('requirements.txt') || rootFiles.has('pyproject.toml')) {
    const reqs =
      getContent('requirements.txt') + getContent('pyproject.toml');
    if (reqs.includes('django')) return 'django';
    if (reqs.includes('fastapi')) return 'fastapi';
    return 'generic-python';
  }

  if (rootFiles.has('go.mod')) return 'go';
  if (rootFiles.has('Gemfile')) return 'rails';

  return 'unknown';
}
