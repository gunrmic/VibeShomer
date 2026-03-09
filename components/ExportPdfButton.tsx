'use client';

import { useState } from 'react';
import type { ReviewResult } from '@/types';

export function ExportPdfButton({ result }: { result: ReviewResult }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewResult: result }),
      });

      if (!res.ok) throw new Error('PDF generation failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = result.repoName || result.projectType;
      a.download = `vibeshomer-report-${name}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleDownload} disabled={loading} className="btn-export">
      {loading ? 'generating...' : '\u2193 download report'}
    </button>
  );
}
