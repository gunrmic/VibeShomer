import type { ReviewResult } from '@/types';
import { IssueCard } from './IssueCard';
import { ExportPdfButton } from './ExportPdfButton';

function ScoreCircle({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const color =
    score >= 80 ? 'var(--ok)' : score >= 60 ? 'var(--warn)' : 'var(--danger)';

  return (
    <div className="score-card" style={{ borderLeftColor: color }}>
      <span className="score-number" style={{ color }}>
        {score}
      </span>
      <span className="score-label">{label}</span>
    </div>
  );
}

export function ReviewReport({
  result,
  onReset,
}: {
  result: ReviewResult;
  onReset: () => void;
}) {
  const criticals = result.issues.filter((i) => i.severity === 'critical');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const infos = result.issues.filter((i) => i.severity === 'info');

  return (
    <div className="report">
      <div className="results-header">
        <span className="results-title">{'// scan results'}</span>
        <div className="results-actions">
          <span className="project-badge">
            {result.projectType.toUpperCase()}
          </span>
          <ExportPdfButton result={result} />
        </div>
      </div>

      <div className="scores-grid">
        <ScoreCircle score={result.score.security} label="SECURITY" />
        <ScoreCircle score={result.score.performance} label="PERFORMANCE" />
      </div>

      <p className="summary">{result.summary}</p>

      {criticals.length > 0 && (
        <div className="issue-group">
          <h3 className="group-title critical">
            CRITICAL ({criticals.length})
          </h3>
          {criticals.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="issue-group">
          <h3 className="group-title warning">
            WARNING ({warnings.length})
          </h3>
          {warnings.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {infos.length > 0 && (
        <div className="issue-group">
          <h3 className="group-title info">INFO ({infos.length})</h3>
          {infos.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {result.issues.length === 0 && (
        <div className="no-issues">
          <p>No issues found. Your code looks clean.</p>
        </div>
      )}

      <button onClick={onReset} className="btn-secondary">
        analyze another
      </button>
    </div>
  );
}
