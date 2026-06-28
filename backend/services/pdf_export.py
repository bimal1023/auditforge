"""
Generate a professionally formatted PE-grade investment memo PDF using fpdf2.

Design language:
  - Full-page dark cover with score gauge, metadata strip, and classification
  - Table of contents with dot leaders
  - Section pages with left accent bar, not filled headers
  - Formal two-column KPI cards with subtle borders
  - Alternating-row data tables
  - Risk matrix with severity indicators
  - Proper citation footnotes with numbered references
  - Confidentiality footer on every page
  - Professional typography hierarchy
"""
from __future__ import annotations

from datetime import datetime, timezone

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from backend.models.report import Citation, DueDiligenceReport

# ---------------------------------------------------------------------------
# Colour palette — restrained institutional tones
# ---------------------------------------------------------------------------
NAVY       = (12,  35,  68)
DARK_NAVY  = (8,   24,  48)
SLATE      = (55,  65,  81)
STEEL      = (100, 116, 139)
ASH        = (148, 163, 184)
SILVER     = (203, 213, 225)
MIST       = (241, 245, 249)
SNOW       = (248, 250, 252)
WHITE      = (255, 255, 255)
BLACK      = (15,  23,  42)

# Accent
BLUE       = (37,  99, 235)
BLUE_LIGHT = (219, 234, 254)

# Severity
RED        = (185,  28,  28)
RED_BG     = (254, 226, 226)
AMBER      = (180,  83,   9)
AMBER_BG   = (254, 243, 199)
GREEN      = (21,  128,  61)
GREEN_BG   = (220, 252, 231)

SEVERITY_COLOR = {"high": RED, "medium": AMBER, "low": GREEN}
SEVERITY_BG    = {"high": RED_BG, "medium": AMBER_BG, "low": GREEN_BG}

# Layout
PAGE_W  = 210  # A4 mm
MARGIN  = 22
CONTENT = PAGE_W - 2 * MARGIN

# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
_UNICODE_MAP = str.maketrans({
    "—": "--", "–": "-", "‒": "-",
    "‘": "'",  "’": "'",
    "“": '"',  "”": '"',
    "…": "...", "•": "*", "·": "*",
    " ": " ",
})


def _s(text: str) -> str:
    """Sanitise Unicode -> Latin-1 so fpdf built-in fonts don't crash."""
    if not text:
        return ""
    return text.translate(_UNICODE_MAP).encode("latin-1", errors="replace").decode("latin-1")


def _usd(v: float | None) -> str:
    if v is None:
        return "N/A"
    if abs(v) >= 1e12:
        return f"${v / 1e12:,.1f}T"
    if abs(v) >= 1e9:
        return f"${v / 1e9:,.1f}B"
    if abs(v) >= 1e6:
        return f"${v / 1e6:,.1f}M"
    return f"${v:,.0f}"


def _pct(v: float | None) -> str:
    return f"{v * 100:.1f}%" if v is not None else "N/A"


def _now_str() -> str:
    return datetime.now(timezone.utc).strftime("%B %d, %Y")


# ---------------------------------------------------------------------------
# PDF subclass
# ---------------------------------------------------------------------------
class _PDF(FPDF):
    _company: str = ""
    _is_cover: bool = True
    _toc_entries: list[tuple[str, int]]  # (title, page_number)

    def __init__(self, **kw):
        super().__init__(**kw)
        self._toc_entries = []

    def header(self):
        if self._is_cover:
            return
        # Thin top rule
        self.set_draw_color(*SILVER)
        self.set_line_width(0.3)
        self.line(MARGIN, 14, PAGE_W - MARGIN, 14)
        # Left: Arthvion branding
        self.set_xy(MARGIN, 8)
        self.set_font("Helvetica", "B", 7.5)
        self.set_text_color(*NAVY)
        self.cell(20, 5, "ARTHVION")
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*STEEL)
        self.cell(0, 5, _s(f"  |  {self._company}"))
        # Right: classification
        self.set_xy(PAGE_W - MARGIN - 40, 8)
        self.set_font("Helvetica", "B", 6.5)
        self.set_text_color(*RED)
        self.cell(40, 5, "CONFIDENTIAL", align="R")
        self.set_y(18)

    def footer(self):
        self.set_y(-12)
        self.set_draw_color(*SILVER)
        self.set_line_width(0.2)
        self.line(MARGIN, self.get_y(), PAGE_W - MARGIN, self.get_y())
        self.ln(1.5)
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(*ASH)
        self.cell(CONTENT / 2, 4,
                  _s("Arthvion Vantage  |  Privileged & Confidential  |  Not for Distribution"))
        self.cell(CONTENT / 2, 4, f"Page {self.page_no()}", align="R")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def generate_pdf(report: DueDiligenceReport) -> bytes:
    pdf = _PDF(orientation="P", unit="mm", format="A4")
    pdf._company = _s(report.company)
    pdf.set_margins(MARGIN, 20, MARGIN)
    pdf.set_auto_page_break(auto=True, margin=16)

    # ── Cover ──
    pdf.add_page()
    _cover(pdf, report)

    # ── Sections (render first, record page numbers) ──
    pdf._is_cover = False

    # Build section list
    sections: list[tuple[str, object | None]] = []
    if report.executive_summary:
        sections.append(("Executive Summary", None))
    if report.financial:
        sections.append(("Financial Analysis", report.financial))
    if report.risk:
        sections.append(("Risk Assessment", report.risk))
    if report.market:
        sections.append(("Market & Competitive Landscape", report.market))
    if report.legal:
        sections.append(("Legal & Regulatory Review", report.legal))

    # Table of contents page (page 2)
    pdf.add_page()
    toc_page = pdf.page_no()
    # Leave space — we'll fill TOC content via overlay after we know page numbers
    # For now, render a placeholder that we'll replace
    toc_y_start = pdf.get_y()

    # Render TOC header now (static)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*STEEL)
    pdf.cell(0, 5, "CONTENTS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(3)
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.8)
    pdf.line(MARGIN, pdf.get_y(), MARGIN + 24, pdf.get_y())
    pdf.ln(8)

    # Reserve TOC lines with page-number aliases
    toc_entries: list[tuple[str, str]] = []  # (title, alias)
    for i, (title, _) in enumerate(sections):
        alias = f"{{pg_sec_{i}}}"
        toc_entries.append((title, alias))

        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*BLACK)
        title_w = pdf.get_string_width(_s(title))
        pdf.cell(title_w + 2, 7, _s(title))
        page_w = pdf.get_string_width("00") + 2
        dots_w = CONTENT - title_w - 2 - page_w
        pdf.set_text_color(*ASH)
        pdf.set_font("Helvetica", "", 8)
        dots = " . " * 40
        pdf.cell(dots_w, 7, dots[:int(dots_w / 1.5)], align="R")
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*NAVY)
        pdf.cell(page_w, 7, alias, align="R",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)

    # Render each section, recording actual page numbers for alias replacement
    render_fns = {
        "Executive Summary": lambda: _exec_summary(pdf, report),
        "Financial Analysis": lambda: _financial_section(pdf, report.financial),
        "Risk Assessment": lambda: _risk_section(pdf, report.risk),
        "Market & Competitive Landscape": lambda: _market_section(pdf, report.market),
        "Legal & Regulatory Review": lambda: _legal_section(pdf, report.legal),
    }
    page_map: dict[str, int] = {}
    for i, (title, _data) in enumerate(sections):
        pdf.add_page()
        page_map[f"pg_sec_{i}"] = pdf.page_no()
        render_fns[title]()

    # Replace aliases in the raw PDF bytes
    raw = bytes(pdf.output())
    for key, num in page_map.items():
        # The alias was written as {pg_sec_N} — fpdf encodes text in the PDF
        # stream, so we replace in the raw bytes.
        alias_bytes = f"{{{key}}}".encode("latin-1")
        # Pad replacement to same length to avoid breaking PDF offsets
        repl = f"{num:>{len(alias_bytes)}}".encode("latin-1")[-len(alias_bytes):]
        raw = raw.replace(alias_bytes, repl)
    return raw


# ---------------------------------------------------------------------------
# Cover page — full dark bleed
# ---------------------------------------------------------------------------
def _cover(pdf: _PDF, report: DueDiligenceReport) -> None:
    # Full-page navy background
    pdf.set_fill_color(*DARK_NAVY)
    pdf.rect(0, 0, PAGE_W, 297, style="F")

    # Classification strip at top
    pdf.set_xy(0, 12)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*ASH)
    pdf.cell(PAGE_W, 5, "CONFIDENTIAL  |  PROPRIETARY", align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Brand
    pdf.set_y(45)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*SILVER)
    pdf.cell(0, 5, "ARTHVION  VANTAGE", align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    # Thin separator
    sep_w = 40
    pdf.set_draw_color(*STEEL)
    pdf.set_line_width(0.4)
    pdf.line((PAGE_W - sep_w) / 2, pdf.get_y(),
             (PAGE_W + sep_w) / 2, pdf.get_y())
    pdf.ln(8)

    # Document type
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*ASH)
    pdf.cell(0, 5, "Due Diligence Investment Memo", align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(10)

    # Company name — big
    pdf.set_font("Helvetica", "B", 32)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 14, _s(report.company), align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    if report.ticker:
        pdf.set_font("Helvetica", "", 13)
        pdf.set_text_color(*ASH)
        pdf.cell(0, 7, f"({_s(report.ticker)})", align="C",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(16)

    # ── Score gauge ──
    if report.overall_score is not None:
        score = report.overall_score
        color = GREEN if score >= 7 else (AMBER if score >= 4 else RED)

        # Score circle-like box
        pill_w = 60
        pill_h = 28
        x = (PAGE_W - pill_w) / 2
        y = pdf.get_y()

        # Outer border
        pdf.set_draw_color(*color)
        pdf.set_line_width(1.2)
        pdf.rect(x, y, pill_w, pill_h, style="D")

        # Score number
        pdf.set_xy(x, y + 3)
        pdf.set_font("Helvetica", "B", 22)
        pdf.set_text_color(*WHITE)
        pdf.cell(pill_w, 12, f"{score:.1f}", align="C",
                 new_x=XPos.LEFT, new_y=YPos.NEXT)

        # Out of 10
        pdf.set_xy(x, y + 15)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*ASH)
        pdf.cell(pill_w, 5, "out of 10.0", align="C",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        pdf.set_y(y + pill_h + 4)

        # Score label
        if score >= 8:
            label = "Strong Buy"
        elif score >= 6.5:
            label = "Favorable"
        elif score >= 4:
            label = "Neutral"
        else:
            label = "Elevated Risk"

        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*color)
        pdf.cell(0, 5, f"Investment Attractiveness:  {label}", align="C",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        pdf.ln(14)

    # ── Metadata strip ──
    pdf.set_draw_color(*STEEL)
    pdf.set_line_width(0.2)
    sep_full = CONTENT - 20
    pdf.line((PAGE_W - sep_full) / 2, pdf.get_y(),
             (PAGE_W + sep_full) / 2, pdf.get_y())
    pdf.ln(6)

    meta_items = [
        ("PREPARED", _now_str()),
        ("PLATFORM", "Arthvion Vantage v2.4"),
        ("CLASSIFICATION", "Confidential"),
    ]
    col_w = CONTENT / len(meta_items)
    y = pdf.get_y()
    for i, (label, value) in enumerate(meta_items):
        x = MARGIN + i * col_w
        pdf.set_xy(x, y)
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(*ASH)
        pdf.cell(col_w, 4, label, align="C", new_x=XPos.LEFT, new_y=YPos.NEXT)
        pdf.set_xy(x, y + 4)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*SILVER)
        pdf.cell(col_w, 5, _s(value), align="C")

    pdf.ln(16)

    # Bottom disclaimer
    pdf.set_y(260)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(*STEEL)
    pdf.multi_cell(0, 3.5, _s(
        "This document is generated by Arthvion Vantage using automated analysis of "
        "public filings, market data, and litigation records. It is intended for "
        "informational purposes only and does not constitute investment advice. "
        "All data should be independently verified before making investment decisions."
    ), align="C")


# ---------------------------------------------------------------------------
# Table of Contents (inserted as page 2)
# ---------------------------------------------------------------------------
def _render_toc(pdf: _PDF, entries: list[tuple[str, int]]) -> None:
    """Render the table of contents on the current page."""
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*STEEL)
    pdf.cell(0, 5, "CONTENTS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(3)

    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.8)
    pdf.line(MARGIN, pdf.get_y(), MARGIN + 24, pdf.get_y())
    pdf.ln(8)

    for title, page in entries:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*BLACK)
        title_w = pdf.get_string_width(_s(title))
        pdf.cell(title_w + 2, 7, _s(title))
        # Dot leader
        page_str = str(page)
        page_w = pdf.get_string_width(page_str) + 2
        dots_w = CONTENT - title_w - 2 - page_w
        pdf.set_text_color(*ASH)
        pdf.set_font("Helvetica", "", 8)
        dots = " . " * 40
        pdf.cell(dots_w, 7, dots[:int(dots_w / 1.5)], align="R")
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*NAVY)
        pdf.cell(page_w, 7, page_str, align="R",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)


# ---------------------------------------------------------------------------
# Executive Summary
# ---------------------------------------------------------------------------
def _exec_summary(pdf: _PDF, report: DueDiligenceReport) -> None:
    _section_title(pdf, "Executive Summary")
    pdf.ln(2)

    # Summary text in slightly larger font
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*SLATE)
    pdf.multi_cell(0, 6, _s(report.executive_summary or ""))
    pdf.ln(4)

    # Quick stats row if we have data
    stats: list[tuple[str, str]] = []
    if report.overall_score is not None:
        stats.append(("Score", f"{report.overall_score:.1f}/10"))
    if report.financial:
        if report.financial.revenue:
            latest = max(report.financial.revenue, key=lambda m: m.year)
            stats.append(("Revenue", _usd(latest.value)))
        if report.financial.ebitda:
            latest = max(report.financial.ebitda, key=lambda m: m.year)
            stats.append(("EBITDA", _usd(latest.value)))
    if report.market and report.market.market_size_usd:
        stats.append(("TAM", _usd(report.market.market_size_usd)))
    if report.risk and report.risk.risks:
        high_count = sum(1 for r in report.risk.risks if r.severity.lower() == "high")
        stats.append(("High Risks", str(high_count)))

    if stats:
        _kpi_row(pdf, stats[:4])  # Max 4 across


# ---------------------------------------------------------------------------
# Section helpers
# ---------------------------------------------------------------------------
def _section_title(pdf: _PDF, title: str) -> None:
    """Section heading with left accent bar — not a filled banner."""
    y = pdf.get_y()
    # Accent bar
    pdf.set_fill_color(*NAVY)
    pdf.rect(MARGIN, y, 3, 10, style="F")
    # Title
    pdf.set_xy(MARGIN + 7, y)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 10, _s(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    # Underline
    pdf.set_draw_color(*SILVER)
    pdf.set_line_width(0.3)
    pdf.line(MARGIN, pdf.get_y() + 1, PAGE_W - MARGIN, pdf.get_y() + 1)
    pdf.ln(5)


def _sub_header(pdf: _PDF, title: str) -> None:
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 6, _s(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)


def _confidence_badge(pdf: _PDF, score: float) -> None:
    color = GREEN if score >= 0.7 else (AMBER if score >= 0.4 else RED)
    bg = GREEN_BG if score >= 0.7 else (AMBER_BG if score >= 0.4 else RED_BG)
    label = f"Confidence: {score * 100:.0f}%"
    w = pdf.get_string_width(label) + 8
    pdf.set_fill_color(*bg)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.set_text_color(*color)
    pdf.cell(w, 5.5, _s(f" {label} "), fill=True,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(3)


def _body(pdf: _PDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(*SLATE)
    pdf.multi_cell(0, 5.2, _s(text))
    pdf.set_text_color(*BLACK)
    pdf.ln(2)


def _rule(pdf: _PDF) -> None:
    pdf.set_draw_color(*MIST)
    pdf.set_line_width(0.3)
    pdf.line(MARGIN, pdf.get_y(), PAGE_W - MARGIN, pdf.get_y())
    pdf.ln(3)


def _kpi_row(pdf: _PDF, items: list[tuple[str, str]]) -> None:
    """Render a row of KPI cards with subtle borders."""
    n = len(items)
    if n == 0:
        return
    gap = 3
    card_w = (CONTENT - gap * (n - 1)) / n
    y = pdf.get_y()

    for i, (label, value) in enumerate(items):
        x = MARGIN + i * (card_w + gap)
        # Card background
        pdf.set_fill_color(*SNOW)
        pdf.set_draw_color(*SILVER)
        pdf.set_line_width(0.3)
        pdf.rect(x, y, card_w, 18, style="DF")
        # Label
        pdf.set_xy(x + 4, y + 2)
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(*STEEL)
        pdf.cell(card_w - 8, 4, _s(label.upper()))
        # Value
        pdf.set_xy(x + 4, y + 7)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(*NAVY)
        pdf.cell(card_w - 8, 8, _s(value))

    pdf.set_y(y + 22)
    pdf.set_text_color(*BLACK)


def _citations(pdf: _PDF, citations: list[Citation]) -> None:
    if not citations:
        return
    pdf.ln(4)
    _rule(pdf)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*STEEL)
    pdf.cell(0, 4, "SOURCES & REFERENCES", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    for i, c in enumerate(citations, 1):
        date = f"  ({c.filing_date})" if c.filing_date else ""
        label = _s(f"[{i}]  {c.source}{date}")
        pdf.set_font("Helvetica", "", 7.5)
        if c.url:
            pdf.set_text_color(*BLUE)
            pdf.cell(0, 4.5, label, link=c.url,
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            pdf.set_text_color(*STEEL)
            pdf.cell(0, 4.5, label, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(3)


# ---------------------------------------------------------------------------
# Financial
# ---------------------------------------------------------------------------
def _financial_section(pdf: _PDF, f) -> None:
    _section_title(pdf, "Financial Analysis")
    _confidence_badge(pdf, f.confidence_score)
    _body(pdf, f.summary)

    # ── KPI cards for latest year ──
    kpis: list[tuple[str, str]] = []
    for label, metrics in [
        ("Revenue", f.revenue), ("Gross Profit", f.gross_profit),
        ("EBITDA", f.ebitda), ("Net Income", f.net_income),
    ]:
        if metrics:
            latest = max(metrics, key=lambda m: m.year)
            growth = ""
            if latest.growth_rate is not None and latest.growth_rate != 0:
                sign = "+" if latest.growth_rate > 0 else ""
                growth = f"  ({sign}{_pct(latest.growth_rate)})"
            kpis.append((f"{label} ({latest.year})", f"{_usd(latest.value)}{growth}"))
    if kpis:
        _kpi_row(pdf, kpis[:4])

    # ── Detailed data tables ──
    metric_groups = [
        ("Revenue",            f.revenue),
        ("Gross Profit",       f.gross_profit),
        ("EBITDA",             f.ebitda),
        ("Net Income",         f.net_income),
        ("Total Debt",         f.total_debt),
        ("Cash & Equivalents", f.cash_and_equivalents),
    ]
    active = [(lbl, rows) for lbl, rows in metric_groups if rows]

    if active:
        _sub_header(pdf, "Historical Financials")
        for label, metrics in active:
            _metric_table(pdf, label, metrics)

    # Key Ratios
    if f.key_ratios:
        _sub_header(pdf, "Key Ratios")
        items = list(f.key_ratios.items())
        # Render as a 2-column table
        col_w = CONTENT / 2
        pdf.set_font("Helvetica", "", 9)
        for i, (k, v) in enumerate(items):
            bg = SNOW if i % 2 == 0 else WHITE
            pdf.set_fill_color(*bg)
            pdf.set_text_color(*SLATE)
            pdf.cell(col_w - 15, 6, _s(f"  {k}"), fill=True)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*NAVY)
            pdf.cell(15, 6, f"{v:.2f}", fill=True, align="R",
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("Helvetica", "", 9)
        pdf.ln(3)

    _citations(pdf, f.citations)


def _metric_table(pdf: _PDF, label: str, metrics) -> None:
    """Render a single metric as a compact alternating-row table."""
    sorted_m = sorted(metrics, key=lambda x: x.year, reverse=True)

    # Table header
    pdf.set_fill_color(*NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(CONTENT * 0.3, 6, _s(f"  {label}"), fill=True)
    pdf.cell(CONTENT * 0.35, 6, "Amount", fill=True, align="R")
    pdf.cell(CONTENT * 0.35, 6, "YoY Growth", fill=True, align="R",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Rows
    for i, m in enumerate(sorted_m):
        bg = SNOW if i % 2 == 0 else WHITE
        pdf.set_fill_color(*bg)

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*SLATE)
        pdf.cell(CONTENT * 0.3, 5.5, f"  {m.year}", fill=True)

        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*BLACK)
        pdf.cell(CONTENT * 0.35, 5.5, _s(_usd(m.value)), fill=True, align="R")

        if m.growth_rate is not None and m.growth_rate != 0:
            sign = "+" if m.growth_rate > 0 else ""
            g_color = GREEN if m.growth_rate >= 0 else RED
            pdf.set_text_color(*g_color)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(CONTENT * 0.35, 5.5, _s(f"{sign}{_pct(m.growth_rate)}"),
                     fill=True, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            pdf.set_text_color(*ASH)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(CONTENT * 0.35, 5.5, "--", fill=True, align="R",
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_text_color(*BLACK)
    pdf.ln(4)


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------
def _risk_section(pdf: _PDF, r) -> None:
    _section_title(pdf, "Risk Assessment")
    _confidence_badge(pdf, r.confidence_score)
    _body(pdf, r.summary)

    # Risk count summary
    highs = sum(1 for x in r.risks if x.severity.lower() == "high")
    meds = sum(1 for x in r.risks if x.severity.lower() == "medium")
    lows = sum(1 for x in r.risks if x.severity.lower() == "low")
    _kpi_row(pdf, [("High Risk", str(highs)), ("Medium Risk", str(meds)), ("Low Risk", str(lows))])

    # Individual risks
    for risk in r.risks:
        sev = risk.severity.lower()
        color = SEVERITY_COLOR.get(sev, STEEL)
        bg = SEVERITY_BG.get(sev, MIST)

        # Left accent + severity badge
        y = pdf.get_y()
        pdf.set_fill_color(*color)
        pdf.rect(MARGIN, y, 2.5, 5.5, style="F")

        pdf.set_xy(MARGIN + 5, y)
        pdf.set_fill_color(*bg)
        pdf.set_text_color(*color)
        pdf.set_font("Helvetica", "B", 7)
        badge_w = pdf.get_string_width(sev.upper()) + 6
        pdf.cell(badge_w, 5.5, _s(f" {sev.upper()} "), fill=True)

        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(*BLACK)
        pdf.cell(0, 5.5, _s(f"  {risk.title}"),
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        pdf.set_x(MARGIN + 5)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(*SLATE)
        pdf.multi_cell(CONTENT - 5, 4.8, _s(risk.description))
        pdf.ln(3)

    _citations(pdf, r.citations)


# ---------------------------------------------------------------------------
# Market
# ---------------------------------------------------------------------------
def _market_section(pdf: _PDF, m) -> None:
    _section_title(pdf, "Market & Competitive Landscape")
    _confidence_badge(pdf, m.confidence_score)
    _body(pdf, m.summary)

    # KPI cards
    kpis: list[tuple[str, str]] = []
    if m.market_size_usd:
        kpis.append(("Total Addressable Market", _usd(m.market_size_usd)))
    if m.market_share:
        kpis.append(("Market Share", _pct(m.market_share)))
    if m.competitors:
        kpis.append(("Tracked Competitors", str(len(m.competitors))))
    if kpis:
        _kpi_row(pdf, kpis[:4])

    # Competitors table
    if m.competitors:
        _sub_header(pdf, "Competitive Set")
        # Header
        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(CONTENT * 0.55, 6, "  Company", fill=True)
        pdf.cell(CONTENT * 0.25, 6, "Market Share", fill=True, align="C")
        pdf.cell(CONTENT * 0.20, 6, "Position", fill=True, align="C",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        # Rows
        for i, c in enumerate(m.competitors):
            bg = SNOW if i % 2 == 0 else WHITE
            pdf.set_fill_color(*bg)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*BLACK)
            pdf.cell(CONTENT * 0.55, 6, _s(f"  {c.name}"), fill=True)
            pdf.set_text_color(*NAVY)
            pdf.set_font("Helvetica", "B", 8.5)
            share = _pct(c.estimated_market_share) if c.estimated_market_share else "--"
            pdf.cell(CONTENT * 0.25, 6, _s(share), fill=True, align="C")
            pdf.set_text_color(*STEEL)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(CONTENT * 0.20, 6, f"#{i + 1}", fill=True, align="C",
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(4)

    # Growth drivers + Headwinds — two columns
    if m.growth_drivers or m.headwinds:
        half = (CONTENT - 6) / 2
        top_y = pdf.get_y()

        if m.growth_drivers:
            pdf.set_xy(MARGIN, top_y)
            # Card border
            pdf.set_draw_color(*GREEN_BG)
            pdf.set_fill_color(*SNOW)
            lines_needed = sum(2 + len(_s(d)) // 50 for d in m.growth_drivers)
            card_h = max(14 + lines_needed * 4, 20)

            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*GREEN)
            pdf.cell(half, 6, _s("  GROWTH DRIVERS"),
                     new_x=XPos.LEFT, new_y=YPos.NEXT)
            pdf.set_fill_color(*GREEN_BG)
            pdf.set_line_width(0.2)
            pdf.line(MARGIN, pdf.get_y(), MARGIN + half, pdf.get_y())
            pdf.ln(2)

            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*SLATE)
            for d in m.growth_drivers:
                pdf.set_x(MARGIN + 2)
                pdf.multi_cell(half - 4, 4.5, _s(f"+ {d}"))
                pdf.ln(0.5)
            drivers_end = pdf.get_y()
        else:
            drivers_end = top_y

        if m.headwinds:
            pdf.set_xy(MARGIN + half + 6, top_y)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*RED)
            pdf.cell(half, 6, _s("  HEADWINDS"),
                     new_x=XPos.LEFT, new_y=YPos.NEXT)
            pdf.set_draw_color(*RED_BG)
            pdf.line(MARGIN + half + 6, top_y + 6, MARGIN + CONTENT, top_y + 6)

            hw_y = top_y + 8
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*SLATE)
            for h in m.headwinds:
                pdf.set_xy(MARGIN + half + 8, hw_y)
                pdf.multi_cell(half - 4, 4.5, _s(f"- {h}"))
                hw_y = pdf.get_y() + 0.5
            headwinds_end = hw_y
        else:
            headwinds_end = top_y

        pdf.set_y(max(drivers_end, headwinds_end) + 3)

    _citations(pdf, m.citations)


# ---------------------------------------------------------------------------
# Legal
# ---------------------------------------------------------------------------
def _legal_section(pdf: _PDF, lg) -> None:
    _section_title(pdf, "Legal & Regulatory Review")
    _confidence_badge(pdf, lg.confidence_score)
    _body(pdf, lg.summary)

    if lg.litigations:
        _sub_header(pdf, "Active Litigation")

        # Table header
        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(CONTENT * 0.45, 6, "  Case", fill=True)
        pdf.cell(CONTENT * 0.20, 6, "Status", fill=True, align="C")
        pdf.cell(CONTENT * 0.35, 6, "Potential Liability", fill=True, align="R",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        for i, lit in enumerate(lg.litigations):
            bg = SNOW if i % 2 == 0 else WHITE
            pdf.set_fill_color(*bg)

            # Case row
            pdf.set_font("Helvetica", "B", 8.5)
            pdf.set_text_color(*BLACK)
            pdf.cell(CONTENT * 0.45, 6, _s(f"  {lit.case_name}"), fill=True)

            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*STEEL)
            pdf.cell(CONTENT * 0.20, 6, _s(lit.status), fill=True, align="C")

            if lit.potential_liability_usd:
                pdf.set_font("Helvetica", "B", 8.5)
                pdf.set_text_color(*RED)
                pdf.cell(CONTENT * 0.35, 6, _usd(lit.potential_liability_usd),
                         fill=True, align="R",
                         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            else:
                pdf.set_text_color(*ASH)
                pdf.cell(CONTENT * 0.35, 6, "--", fill=True, align="R",
                         new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            # Description below
            if lit.description:
                pdf.set_x(MARGIN + 4)
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*SLATE)
                pdf.multi_cell(CONTENT - 8, 4.5, _s(lit.description))
                pdf.ln(1)

        pdf.ln(3)

    if lg.regulatory_issues:
        _sub_header(pdf, "Regulatory Issues")
        for i, item in enumerate(lg.regulatory_issues):
            agency = str(item.get("agency", "")) if item.get("agency") else ""
            desc = str(item.get("description", ""))
            bg = SNOW if i % 2 == 0 else WHITE

            pdf.set_fill_color(*bg)
            if agency:
                pdf.set_font("Helvetica", "B", 8.5)
                pdf.set_text_color(*AMBER)
                pdf.cell(0, 5.5, _s(f"  {agency}"), fill=True,
                         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_x(MARGIN + 4)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*SLATE)
            pdf.multi_cell(CONTENT - 8, 4.5, _s(desc), fill=True)
            pdf.ln(1)
        pdf.ln(2)

    _citations(pdf, lg.citations)
