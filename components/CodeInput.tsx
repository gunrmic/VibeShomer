'use client';

import { useState } from 'react';

const LANGUAGES = [
  { value: 'generic-js', label: 'JavaScript / TypeScript' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'express', label: 'Express' },
  { value: 'django', label: 'Django (Python)' },
  { value: 'fastapi', label: 'FastAPI (Python)' },
  { value: 'rails', label: 'Rails (Ruby)' },
  { value: 'go', label: 'Go' },
  { value: 'generic-python', label: 'Python (generic)' },
];

interface CodeInputProps {
  onSubmit: (code: string, language: string) => void;
  loading: boolean;
}

export function CodeInput({ onSubmit, loading }: CodeInputProps) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('generic-js');

  const handleSubmit = () => {
    if (!code.trim()) return;
    onSubmit(code, language);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="input-section">
      <div className="input-controls">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="language-select"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste your code here..."
        className="code-textarea"
        spellCheck={false}
      />
      <div className="input-footer">
        <span className="hint">Cmd+Enter to analyze</span>
        <button
          onClick={handleSubmit}
          disabled={loading || !code.trim()}
          className="btn-primary"
        >
          {loading ? 'analyzing...' : 'analyze code'}
        </button>
      </div>
    </div>
  );
}
