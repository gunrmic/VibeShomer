import type { Issue } from '@/types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)',
  warning: 'var(--warn)',
  info: 'var(--ok)',
};

export function IssueCard({ issue }: { issue: Issue }) {
  const color = SEVERITY_COLORS[issue.severity] ?? 'var(--muted)';

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
