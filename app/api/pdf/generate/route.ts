import { jsPDF } from 'jspdf';

const COLORS = {
  bg: '#080b10',
  surface: '#0e1420',
  accent: '#00e5ff',
  accent2: '#7c4dff',
  danger: '#ff3d5a',
  warn: '#ffab00',
  ok: '#00e676',
  text: '#dce8ff',
  muted: '#4a5a7a',
  codeBg: '#040608',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: COLORS.danger,
  warning: COLORS.warn,
  info: COLORS.ok,
};

function scoreColor(s: number): string {
  if (s >= 80) return COLORS.ok;
  if (s >= 60) return COLORS.warn;
  return COLORS.danger;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = body.reviewResult;
    if (!result) {
      return new Response(JSON.stringify({ error: 'No reviewResult' }), { status: 400 });
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    const M = 18;
    const contentW = W - 2 * M;
    let y = M;

    // Background
    doc.setFillColor(...hexToRgb(COLORS.bg));
    doc.rect(0, 0, 210, 297, 'F');

    // Header
    doc.setTextColor(...hexToRgb(COLORS.accent));
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    doc.text('VIBESHOMER', M, y);
    y += 6;

    doc.setTextColor(...hexToRgb(COLORS.text));
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Security & Performance Report', M, y);
    y += 7;

    const ptype = (result.projectType ?? 'unknown').toUpperCase();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    doc.setTextColor(...hexToRgb(COLORS.muted));
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.text(`// ${ptype}  ·  ${now}`, M, y);
    y += 4;

    // Accent line
    doc.setDrawColor(...hexToRgb(COLORS.accent));
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 8;

    // Scores
    doc.setFontSize(7);
    doc.setFont('courier', 'bold');
    doc.setTextColor(...hexToRgb(COLORS.muted));
    doc.text('// SCORES', M, y);
    y += 6;

    const secScore = result.score?.security ?? 0;
    const perfScore = result.score?.performance ?? 0;

    // Security score box
    const boxW = (contentW - 6) / 2;
    doc.setFillColor(...hexToRgb(COLORS.surface));
    doc.setDrawColor(...hexToRgb('#1c2640'));
    doc.roundedRect(M, y, boxW, 18, 1, 1, 'FD');
    doc.setFillColor(...hexToRgb(scoreColor(secScore)));
    doc.rect(M, y, 2, 18, 'F');
    doc.setTextColor(...hexToRgb(scoreColor(secScore)));
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(String(secScore), M + 6, y + 12);
    doc.setTextColor(...hexToRgb(COLORS.muted));
    doc.setFontSize(7);
    doc.setFont('courier', 'bold');
    doc.text('SECURITY', M + 22, y + 12);

    // Performance score box
    const boxX2 = M + boxW + 6;
    doc.setFillColor(...hexToRgb(COLORS.surface));
    doc.roundedRect(boxX2, y, boxW, 18, 1, 1, 'FD');
    doc.setFillColor(...hexToRgb(scoreColor(perfScore)));
    doc.rect(boxX2, y, 2, 18, 'F');
    doc.setTextColor(...hexToRgb(scoreColor(perfScore)));
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(String(perfScore), boxX2 + 6, y + 12);
    doc.setTextColor(...hexToRgb(COLORS.muted));
    doc.setFontSize(7);
    doc.setFont('courier', 'bold');
    doc.text('PERFORMANCE', boxX2 + 22, y + 12);
    y += 24;

    // Summary
    doc.setFontSize(7);
    doc.setFont('courier', 'bold');
    doc.setTextColor(...hexToRgb(COLORS.muted));
    doc.text('// SUMMARY', M, y);
    y += 5;

    doc.setFillColor(...hexToRgb(COLORS.surface));
    doc.setDrawColor(...hexToRgb(COLORS.accent));
    doc.setLineWidth(0.3);
    const summaryText = result.summary ?? '';
    const summaryLines = doc.splitTextToSize(summaryText, contentW - 12);
    const summaryH = summaryLines.length * 4.5 + 8;
    doc.roundedRect(M, y, contentW, summaryH, 1, 1, 'FD');
    doc.setTextColor(...hexToRgb(COLORS.text));
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(summaryLines, M + 6, y + 6);
    y += summaryH + 6;

    // Issues
    const issues = result.issues ?? [];
    for (const severity of ['critical', 'warning', 'info'] as const) {
      const group = issues.filter((i: { severity: string }) => i.severity === severity);
      if (group.length === 0) continue;

      // Check page space
      if (y > 260) {
        doc.addPage();
        doc.setFillColor(...hexToRgb(COLORS.bg));
        doc.rect(0, 0, 210, 297, 'F');
        y = M;
      }

      const scolor = SEVERITY_COLOR[severity];
      doc.setDrawColor(...hexToRgb(scolor));
      doc.setLineWidth(0.3);
      doc.line(M, y, W - M, y);
      y += 5;

      doc.setTextColor(...hexToRgb(scolor));
      doc.setFontSize(8);
      doc.setFont('courier', 'bold');
      doc.text(`▲ ${severity.toUpperCase()} (${group.length})`, M, y);
      y += 6;

      for (const issue of group) {
        // Estimate card height
        const titleLines = doc.splitTextToSize(issue.title ?? '', contentW - 16);
        const explLines = doc.splitTextToSize(issue.explanation ?? '', contentW - 16);
        let cardH = 8 + titleLines.length * 5 + 4 + explLines.length * 4 + 4;
        if (issue.badCode) cardH += 12;
        if (issue.fix) cardH += 12;
        if (issue.location) cardH += 5;

        if (y + cardH > 280) {
          doc.addPage();
          doc.setFillColor(...hexToRgb(COLORS.bg));
          doc.rect(0, 0, 210, 297, 'F');
          y = M;
        }

        // Card background
        doc.setFillColor(...hexToRgb(COLORS.surface));
        doc.setDrawColor(...hexToRgb('#1c2640'));
        doc.setLineWidth(0.3);
        doc.roundedRect(M, y, contentW, cardH, 1, 1, 'FD');

        // Left color bar
        doc.setFillColor(...hexToRgb(scolor));
        doc.rect(M, y, 2, cardH, 'F');

        let cy = y + 5;

        // Title
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(titleLines, M + 8, cy);
        cy += titleLines.length * 5 + 2;

        // Category
        doc.setTextColor(...hexToRgb(COLORS.muted));
        doc.setFontSize(7);
        doc.setFont('courier', 'normal');
        doc.text(`// ${issue.category ?? ''}`, M + 8, cy);
        cy += 4;

        // Explanation
        doc.setTextColor(...hexToRgb('#9ab0d0'));
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(explLines, M + 8, cy);
        cy += explLines.length * 4 + 3;

        // Bad code
        if (issue.badCode) {
          doc.setFillColor(...hexToRgb(COLORS.codeBg));
          doc.roundedRect(M + 6, cy - 2, contentW - 14, 10, 0.5, 0.5, 'F');
          doc.setTextColor(...hexToRgb(COLORS.danger));
          doc.setFontSize(7);
          doc.setFont('courier', 'normal');
          const badLines = doc.splitTextToSize(issue.badCode, contentW - 20);
          doc.text(badLines.slice(0, 2), M + 8, cy + 2);
          cy += 12;
        }

        // Fix
        if (issue.fix) {
          doc.setFillColor(...hexToRgb(COLORS.codeBg));
          doc.roundedRect(M + 6, cy - 2, contentW - 14, 10, 0.5, 0.5, 'F');
          doc.setTextColor(...hexToRgb(COLORS.ok));
          doc.setFontSize(7);
          doc.setFont('courier', 'normal');
          const fixLines = doc.splitTextToSize(issue.fix, contentW - 20);
          doc.text(fixLines.slice(0, 2), M + 8, cy + 2);
          cy += 12;
        }

        // Location
        if (issue.location) {
          doc.setTextColor(...hexToRgb(COLORS.accent2));
          doc.setFontSize(7);
          doc.setFont('courier', 'normal');
          doc.text(`↳ ${issue.location}`, M + 8, cy);
        }

        y += cardH + 4;
      }
    }

    // Footer
    if (y > 270) {
      doc.addPage();
      doc.setFillColor(...hexToRgb(COLORS.bg));
      doc.rect(0, 0, 210, 297, 'F');
      y = M;
    }
    y += 8;
    doc.setDrawColor(...hexToRgb('#1c2640'));
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 5;
    doc.setTextColor(...hexToRgb(COLORS.muted));
    doc.setFontSize(7);
    doc.setFont('courier', 'normal');
    doc.text('VibeShomer  ·  watching your code so you don\'t have to  ·  vibeshomer.dev', W / 2, y, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');
    const ts = Math.floor(Date.now() / 1000);
    const filename = `vibeshomer-report-${result.projectType ?? 'report'}-${ts}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return new Response(
      JSON.stringify({ error: 'PDF generation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
