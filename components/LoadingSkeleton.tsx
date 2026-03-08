export function LoadingSkeleton() {
  return (
    <div className="loading-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-line wide pulse" />
        <div className="skeleton-line medium pulse" />
      </div>
      <div className="skeleton-scores">
        <div className="skeleton-score pulse" />
        <div className="skeleton-score pulse" />
      </div>
      <div className="skeleton-issues">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card pulse" />
        ))}
      </div>
      <p className="scanning-text">
        <span className="scan-dot" />
        scanning for vulnerabilities...
      </p>
    </div>
  );
}
