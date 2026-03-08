import { describe, it, expect } from 'vitest';
import { detectProjectType } from '@/lib/projectDetector';

describe('detectProjectType', () => {
  it('detects nextjs from package.json with "next"', () => {
    const files = [{ path: 'package.json', content: '{"dependencies": {"next": "14"}}' }];
    expect(detectProjectType(files)).toBe('nextjs');
  });

  it('detects express from package.json with "express"', () => {
    const files = [{ path: 'package.json', content: '{"dependencies": {"express": "4"}}' }];
    expect(detectProjectType(files)).toBe('express');
  });

  it('returns generic-js for package.json without specific framework', () => {
    const files = [{ path: 'package.json', content: '{"dependencies": {"lodash": "4"}}' }];
    expect(detectProjectType(files)).toBe('generic-js');
  });

  it('detects django from requirements.txt', () => {
    const files = [{ path: 'requirements.txt', content: 'django==4.2\ncelery==5.0' }];
    expect(detectProjectType(files)).toBe('django');
  });

  it('detects fastapi from pyproject.toml', () => {
    const files = [{ path: 'pyproject.toml', content: '[tool.poetry]\nfastapi = "^0.100"' }];
    expect(detectProjectType(files)).toBe('fastapi');
  });

  it('returns generic-python for python project without framework match', () => {
    const files = [{ path: 'requirements.txt', content: 'requests==2.31\nnumpy==1.24' }];
    expect(detectProjectType(files)).toBe('generic-python');
  });

  it('detects go from go.mod', () => {
    const files = [{ path: 'go.mod', content: 'module github.com/user/app' }];
    expect(detectProjectType(files)).toBe('go');
  });

  it('detects rails from Gemfile', () => {
    const files = [{ path: 'Gemfile', content: 'gem "rails", "~> 7.0"' }];
    expect(detectProjectType(files)).toBe('rails');
  });

  it('returns unknown when no recognizable files', () => {
    const files = [{ path: 'random.txt', content: 'hello' }];
    expect(detectProjectType(files)).toBe('unknown');
  });

  it('returns unknown for empty files array', () => {
    expect(detectProjectType([])).toBe('unknown');
  });

  it('prioritizes package.json over requirements.txt', () => {
    const files = [
      { path: 'package.json', content: '{"dependencies": {"next": "14"}}' },
      { path: 'requirements.txt', content: 'django==4.2' },
    ];
    expect(detectProjectType(files)).toBe('nextjs');
  });
});
