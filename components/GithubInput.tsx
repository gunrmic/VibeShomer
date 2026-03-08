'use client';

import { useState } from 'react';

interface GithubInputProps {
  onSubmit: (url: string, token?: string) => void;
  loading: boolean;
}

export function GithubInput({ onSubmit, loading }: GithubInputProps) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = () => {
    if (!url.trim()) return;
    onSubmit(url, token || undefined);
  };

  return (
    <div className="input-section">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/owner/repo"
        className="url-input"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Personal Access Token (optional, for private repos)"
        className="token-input"
      />
      <p className="privacy-note">
        We only read files. Nothing is stored.
      </p>
      <div className="input-footer">
        <span />
        <button
          onClick={handleSubmit}
          disabled={loading || !url.trim()}
          className="btn-primary"
        >
          {loading ? 'analyzing...' : 'analyze repo'}
        </button>
      </div>
    </div>
  );
}
