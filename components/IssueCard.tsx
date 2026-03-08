'use client';

import { useState } from 'react';
import type { Issue } from '@/types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)',
  warning: 'var(--warn)',
  info: 'var(--ok)',
};

function buildFixPrompt(issue: Issue): string {
  const parts = [
    `Fix this ${issue.severity} ${issue.category} issue in my code:`,
    ``,
    `**Issue:** ${issue.title}`,
    `**Problem:** ${issue.explanation}`,
  ];
  if (issue.location) parts.push(`**Location:** ${issue.location}`);
  if (issue.badCode) parts.push(``, `**Current code:**`, '```', issue.badCode, '```');
  if (issue.fix) parts.push(``, `**Suggested fix:** ${issue.fix}`);
  parts.push(
    ``,
    `Please provide the corrected code with an explanation of what was changed and why.`
  );
  return parts.join('\n');
}

export function IssueCard({ issue }: { issue: Issue }) {
  const [copied, setCopied] = useState(false);
  const color = SEVERITY_COLORS[issue.severity] ?? 'var(--muted)';

  const handleCopyPrompt = async () => {
    const prompt = buildFixPrompt(issue);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="issue-card"
      style={{ borderLeftColor: color }}
    >
      <div className="issue-header">
        <span
          className="severity-badge"
          style={{ color, borderColor: color }}
        >
          {issue.severity.toUpperCase()}
        </span>
        <span className="category-label">{'// '}{issue.category}</span>
        <button onClick={handleCopyPrompt} className="btn-copy-prompt">
          {copied ? 'copied!' : 'copy fix prompt'}
        </button>
      </div>
      <h4 className="issue-title">{issue.title}</h4>
      <p className="issue-explanation">{issue.explanation}</p>
      {issue.location && (
        <p className="issue-location">&#8627; {issue.location}</p>
      )}
      {issue.badCode && (
        <div className="code-block bad">
          <span className="code-label">{'// bad'}</span>
          <pre>{issue.badCode}</pre>
        </div>
      )}
      {issue.fix && (
        <div className="code-block fix">
          <span className="code-label">{'// fix'}</span>
          <pre>{issue.fix}</pre>
        </div>
      )}
    </div>
  );
}
