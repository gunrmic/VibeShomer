'use client';

import { useState } from 'react';

function detectLanguageFromCode(code: string): string {
  const c = code.toLowerCase();

  // Next.js signals
  if (
    c.includes("'use server'") || c.includes('"use server"') ||
    c.includes("'use client'") || c.includes('"use client"') ||
    c.includes('from "next') || c.includes("from 'next") ||
    c.includes('next/') || c.includes('getserversideprops') ||
    c.includes('getstaticprops') || c.includes('nextresponse') ||
    c.includes('nextrequest')
  ) return 'nextjs';

  // Express signals
  if (
    c.includes('express()') || c.includes("require('express')") ||
    c.includes('require("express")') || c.includes("from 'express'") ||
    c.includes('app.get(') || c.includes('app.post(') ||
    c.includes('router.get(') || c.includes('router.post(') ||
    c.includes('req, res') || c.includes('req, res, next')
  ) return 'express';

  // Django signals
  if (
    c.includes('from django') || c.includes('import django') ||
    c.includes('httpresponse') || c.includes('def get(self') ||
    c.includes('def post(self') || c.includes('@csrf_exempt') ||
    c.includes('@login_required') || c.includes('models.model')
  ) return 'django';

  // FastAPI signals
  if (
    c.includes('from fastapi') || c.includes('import fastapi') ||
    c.includes('fastapi()') || c.includes('@app.get') ||
    c.includes('@app.post') || c.includes('@router.get') ||
    c.includes('pydantic') || c.includes('async def ')
  ) {
    // Distinguish from generic Python with async
    if (c.includes('fastapi') || c.includes('pydantic')) return 'fastapi';
  }

  // Rails signals
  if (
    c.includes('applicationcontroller') || c.includes('< activerecord') ||
    c.includes('rails') || c.includes('render json:') ||
    c.includes('before_action') || c.includes('has_many') ||
    c.includes('belongs_to') || c.includes('def index') && c.includes('def show')
  ) return 'rails';

  // Go signals
  if (
    c.includes('package main') || c.includes('func main()') ||
    c.includes('fmt.') || c.includes('http.handlefunc') ||
    c.includes('http.listenandserve') || c.includes('func (') ||
    c.includes('import (') && c.includes('"net/http"')
  ) return 'go';

  // Generic Python vs JS detection
  const pythonSignals = [
    'def ', 'import ', 'from ', 'class ', 'self.', 'print(',
    '__init__', '__name__', 'elif ', 'except:', 'try:',
  ];
  const jsSignals = [
    'const ', 'let ', 'var ', 'function ', '=>', 'async ',
    'import ', 'export ', 'require(', 'console.log', '===',
    'interface ', 'type ', 'React', 'useState', 'document.',
  ];

  const pyScore = pythonSignals.filter(s => c.includes(s)).length;
  const jsScore = jsSignals.filter(s => c.includes(s)).length;

  if (pyScore > jsScore && pyScore >= 2) return 'generic-python';
  if (jsScore >= 2) return 'generic-js';

  return 'unknown';
}

interface CodeInputProps {
  onSubmit: (code: string, language: string) => void;
  loading: boolean;
}

export function CodeInput({ onSubmit, loading }: CodeInputProps) {
  const [code, setCode] = useState('');

  const detected = code.trim() ? detectLanguageFromCode(code) : null;

  const handleSubmit = () => {
    if (!code.trim()) return;
    onSubmit(code, detectLanguageFromCode(code));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  const LABELS: Record<string, string> = {
    nextjs: 'Next.js',
    express: 'Express',
    django: 'Django',
    fastapi: 'FastAPI',
    rails: 'Rails',
    go: 'Go',
    'generic-js': 'JavaScript / TypeScript',
    'generic-python': 'Python',
    unknown: 'Auto-detect',
  };

  return (
    <div className="input-section">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste your code here..."
        className="code-textarea"
        spellCheck={false}
      />
      <div className="input-footer">
        <span className="hint">
          {detected ? `Detected: ${LABELS[detected] ?? detected}` : 'Cmd+Enter to analyze'}
        </span>
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
