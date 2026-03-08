from http.server import BaseHTTPRequestHandler
import json, io, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.graphics.shapes import Drawing, Path, Ellipse, Circle
from reportlab.graphics import renderPDF

# Brand colors
BG        = colors.HexColor('#080b10')
SURFACE   = colors.HexColor('#0e1420')
BORDER    = colors.HexColor('#1c2640')
ACCENT    = colors.HexColor('#00e5ff')
ACCENT2   = colors.HexColor('#7c4dff')
DANGER    = colors.HexColor('#ff3d5a')
WARN      = colors.HexColor('#ffab00')
OK        = colors.HexColor('#00e676')
TEXT      = colors.HexColor('#dce8ff')
MUTED     = colors.HexColor('#4a5a7a')
CODE_BG   = colors.HexColor('#040608')

SEVERITY_COLOR = {'critical': DANGER, 'warning': WARN, 'info': OK}
SCORE_COLOR    = lambda s: OK if s >= 80 else (WARN if s >= 60 else DANGER)


def make_styles():
    return {
        'eyebrow': ParagraphStyle('eyebrow',
            fontName='Courier-Bold', fontSize=8, textColor=ACCENT,
            spaceAfter=4, leading=12, alignment=TA_LEFT),
        'title': ParagraphStyle('title',
            fontName='Helvetica-Bold', fontSize=22, textColor=TEXT,
            spaceAfter=2, leading=26),
        'tagline': ParagraphStyle('tagline',
            fontName='Courier', fontSize=9, textColor=MUTED,
            spaceAfter=16, leading=13),
        'section': ParagraphStyle('section',
            fontName='Courier-Bold', fontSize=8, textColor=MUTED,
            spaceBefore=14, spaceAfter=6, leading=12),
        'summary': ParagraphStyle('summary',
            fontName='Helvetica', fontSize=10, textColor=TEXT,
            spaceAfter=6, leading=15, backColor=SURFACE,
            borderColor=ACCENT, borderWidth=0.5, borderPad=8),
        'issue_title': ParagraphStyle('issue_title',
            fontName='Helvetica-Bold', fontSize=11, textColor=TEXT,
            spaceAfter=3, leading=14),
        'issue_body': ParagraphStyle('issue_body',
            fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#9ab0d0'),
            spaceAfter=4, leading=13),
        'code': ParagraphStyle('code',
            fontName='Courier', fontSize=8, textColor=DANGER,
            spaceAfter=3, leading=12, backColor=CODE_BG,
            borderColor=BORDER, borderWidth=0.5, borderPad=6),
        'fix': ParagraphStyle('fix',
            fontName='Courier', fontSize=8, textColor=OK,
            spaceAfter=3, leading=12, backColor=CODE_BG,
            borderColor=colors.HexColor('#003d28'), borderWidth=0.5, borderPad=6),
        'location': ParagraphStyle('location',
            fontName='Courier', fontSize=8, textColor=ACCENT2,
            spaceAfter=8, leading=11),
        'footer': ParagraphStyle('footer',
            fontName='Courier', fontSize=7, textColor=MUTED,
            alignment=TA_CENTER, leading=10),
    }


def shield_eye_logo(size=28):
    d = Drawing(size, size)
    s = size

    shield = Path(strokeColor=ACCENT, strokeWidth=1.2, fillColor=SURFACE)
    shield.moveTo(s*0.5, s*0.96)
    shield.curveTo(s*0.1, s*0.78, s*0.06, s*0.52, s*0.06, s*0.36)
    shield.lineTo(s*0.06, s*0.14)
    shield.lineTo(s*0.5, s*0.04)
    shield.lineTo(s*0.94, s*0.14)
    shield.lineTo(s*0.94, s*0.36)
    shield.curveTo(s*0.94, s*0.52, s*0.90, s*0.78, s*0.5, s*0.96)
    shield.closePath()
    d.add(shield)

    cx, cy = size / 2, size / 2
    eye = Ellipse(cx, cy + 1, s*0.22, s*0.14,
                  strokeColor=ACCENT, strokeWidth=0.8, fillColor=None)
    d.add(eye)
    iris = Circle(cx, cy + 1, s*0.08, strokeColor=None, fillColor=ACCENT)
    d.add(iris)
    highlight = Circle(cx + s*0.03, cy + s*0.04, s*0.025,
                        strokeColor=None, fillColor=colors.white)
    d.add(highlight)
    return d


def score_badge(score, label):
    color = SCORE_COLOR(score)
    hex_color = '#%02x%02x%02x' % (int(color.red*255), int(color.green*255), int(color.blue*255))
    return Table(
        [[Paragraph(f'<font color="{hex_color}" size="20"><b>{score}</b></font>',
                    ParagraphStyle('s', fontName='Helvetica-Bold', fontSize=20,
                                   textColor=color, leading=22, alignment=TA_CENTER)),
          Paragraph(f'<font color="#4a5a7a" size="8">{label.upper()}</font>',
                    ParagraphStyle('l', fontName='Courier-Bold', fontSize=8,
                                   textColor=MUTED, leading=11))]],
        colWidths=[36*mm, 40*mm],
        style=TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('BACKGROUND', (0,0), (-1,-1), SURFACE),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER),
            ('LINEBEFORE', (0,0), (0,-1), 3, color),
        ])
    )


def build_pdf(result):
    buf = io.BytesIO()
    W, H = A4
    M = 18*mm

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=M, rightMargin=M, topMargin=M, bottomMargin=M,
        title='VibeShomer Security Report',
        author='VibeShomer',
    )

    styles = make_styles()
    story  = []

    now = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
    ptype = result.get('projectType', 'unknown').upper()

    header_table = Table(
        [[shield_eye_logo(32),
          [Paragraph('VIBESHOMER', styles['eyebrow']),
           Paragraph('Security &amp; Performance Report', styles['title']),
           Paragraph(f'// {ptype}  \u00b7  {now}', styles['tagline'])],
          '']],
        colWidths=[14*mm, 120*mm, None],
        style=TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (1,0), (1,0), 10),
        ])
    )
    story.append(header_table)
    story.append(HRFlowable(width='100%', thickness=0.5, color=ACCENT, spaceAfter=14))

    story.append(Paragraph('// scores', styles['section']))
    sec_score  = result.get('score', {}).get('security', 0)
    perf_score = result.get('score', {}).get('performance', 0)

    scores_table = Table(
        [[score_badge(sec_score, 'Security'),
          score_badge(perf_score, 'Performance')]],
        colWidths=[(W - 2*M) / 2 - 3*mm, (W - 2*M) / 2 - 3*mm],
        hAlign='LEFT',
        style=TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ])
    )
    story.append(scores_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph('// summary', styles['section']))
    story.append(Paragraph(result.get('summary', ''), styles['summary']))
    story.append(Spacer(1, 6))

    issues = result.get('issues', [])
    for severity in ('critical', 'warning', 'info'):
        group = [i for i in issues if i.get('severity') == severity]
        if not group:
            continue

        scolor = SEVERITY_COLOR[severity]
        story.append(HRFlowable(width='100%', thickness=0.3, color=scolor,
                                spaceBefore=10, spaceAfter=6))
        story.append(Paragraph(
            f'\u25b2 {severity.upper()} ({len(group)})',
            ParagraphStyle('grp', fontName='Courier-Bold', fontSize=8,
                           textColor=scolor, leading=11, spaceAfter=6)
        ))

        for issue in group:
            content = []
            content.append(Paragraph(issue.get('title', ''), styles['issue_title']))
            cat = issue.get('category', '')
            content.append(Paragraph(
                f'<font color="#4a5a7a">// {cat}</font>',
                ParagraphStyle('cat', fontName='Courier', fontSize=8,
                               textColor=MUTED, spaceAfter=4, leading=11)
            ))
            content.append(Paragraph(issue.get('explanation', ''), styles['issue_body']))

            if issue.get('badCode'):
                content.append(Paragraph(
                    issue['badCode'].replace('&', '&amp;').replace('<', '&lt;'),
                    styles['code']
                ))
            if issue.get('fix'):
                content.append(Paragraph(
                    issue['fix'].replace('&', '&amp;').replace('<', '&lt;'),
                    styles['fix']
                ))
            if issue.get('location'):
                content.append(Paragraph(f'\u21b3 {issue["location"]}', styles['location']))

            card = Table(
                [['', content]],
                colWidths=[3, W - 2*M - 3 - 6],
                style=TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), SURFACE),
                    ('BACKGROUND', (0,0), (0,-1), scolor),
                    ('LEFTPADDING', (1,0), (1,-1), 10),
                    ('RIGHTPADDING', (1,0), (1,-1), 8),
                    ('TOPPADDING', (0,0), (-1,-1), 8),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                    ('LEFTPADDING', (0,0), (0,-1), 0),
                    ('RIGHTPADDING', (0,0), (0,-1), 0),
                    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ])
            )
            story.append(card)
            story.append(Spacer(1, 5))

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width='100%', thickness=0.3, color=BORDER))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        'VibeShomer  \u00b7  watching your code so you don\'t have to  \u00b7  vibeshomer.dev',
        styles['footer']
    ))

    doc.build(story)
    return buf.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = json.loads(self.rfile.read(length))
        result = body.get('reviewResult', {})
        ptype  = result.get('projectType', 'report')
        ts     = int(datetime.datetime.utcnow().timestamp())

        pdf_bytes = build_pdf(result)
        filename  = f'vibeshomer-report-{ptype}-{ts}.pdf'

        self.send_response(200)
        self.send_header('Content-Type', 'application/pdf')
        self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.send_header('Content-Length', str(len(pdf_bytes)))
        self.end_headers()
        self.wfile.write(pdf_bytes)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
