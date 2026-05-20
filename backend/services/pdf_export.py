"""
Generate a professionally formatted PDF for a DueDiligenceReport using fpdf2.

Design:
  - Dark navy cover band with company name + score
  - Colored section headers (navy fill, white text)
  - Financial data in aligned tables
  - Risk items with severity colour chips
  - Clickable hyperlinks on every citation that has a URL
  - Page numbers in footer
"""
from __future__ import annotations

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from backend.models.report import Citation, DueDiligenceReport

# ---------------------------------------------------------------------------
# Colour palette
# ---------------------------------------------------------------------------
NAVY   = (15,  40,  80)
BLUE   = (41,  98, 178)
LIGHT  = (235, 240, 250)
GREY   = (100, 100, 100)
RED    = (180,  30,  30)
ORANGE = (190,  90,   0)
GREEN  = (20,  120,  60)
WHITE  = (255, 255, 255)
BLACK  = (20,   20,  20)

SEVERITY_COLOR = {"high": RED, "medium": ORANGE, "low": GREEN}

# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------
_UNICODE_MAP = str.maketrans({
    "—": "--", "–": "-", "‒": "-",
    "‘": "'",  "’": "'",
    "“": '"',  "”": '"',
    "…": "...", "•": "*", "·": "*",
    " ": " ",
})

def _s(text: str) -> str:
    """Sanitise Unicode → Latin-1 so fpdf built-in fonts don't crash."""
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


# ---------------------------------------------------------------------------
# PDF subclass — adds header/footer
# ---------------------------------------------------------------------------
class _PDF(FPDF):
    _company: str = ""

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GREY)
        self.cell(0, 6, _s(f"AuditForge  |  {self._company}  |  Confidential"),
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*LIGHT)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)

    def footer(self):
        self.set_y(-13)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GREY)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def generate_pdf(report: DueDiligenceReport) -> bytes:
    pdf = _PDF(orientation="P", unit="mm", format="A4")
    pdf._company = report.company
    pdf.set_margins(20, 20, 20)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    _cover(pdf, report)

    if report.financial:
        _financial_section(pdf, report.financial)
    if report.risk:
        _risk_section(pdf, report.risk)
    if report.market:
        _market_section(pdf, report.market)
    if report.legal:
        _legal_section(pdf, report.legal)

    return bytes(pdf.output())


# ---------------------------------------------------------------------------
# Cover page
# ---------------------------------------------------------------------------
def _cover(pdf: _PDF, report: DueDiligenceReport) -> None:
    # Navy banner
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, pdf.w, 48, style="F")

    pdf.set_y(10)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 6, "AUDITFORGE", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(180, 200, 230)
    pdf.cell(0, 5, "Private Equity Due Diligence Report", align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*WHITE)
    pdf.ln(2)
    pdf.cell(0, 10, _s(report.company), align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    if report.ticker:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(180, 200, 230)
        pdf.cell(0, 5, f"({report.ticker})", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(14)
    pdf.set_text_color(*BLACK)

    # Score pill + label
    if report.overall_score is not None:
        score = report.overall_score
        color = GREEN if score >= 7 else (ORANGE if score >= 4 else RED)
        pdf.set_fill_color(*color)
        pill_w = 52
        x = (pdf.w - pill_w) / 2
        pdf.set_xy(x, pdf.get_y())
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(*WHITE)
        pdf.cell(pill_w, 10, f"{score:.1f} / 10.0", align="C", fill=True,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 5, "Investment Attractiveness Score", align="C",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(4)

    # Thin divider
    pdf.set_text_color(*BLACK)
    _rule(pdf)

    # Executive summary
    if report.executive_summary:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 7, "Executive Summary", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*BLACK)
        pdf.multi_cell(0, 5.5, _s(report.executive_summary))
        pdf.ln(3)
        _rule(pdf)


# ---------------------------------------------------------------------------
# Section helpers
# ---------------------------------------------------------------------------
def _section_header(pdf: _PDF, title: str) -> None:
    pdf.ln(3)
    pdf.set_fill_color(*NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 9, f"  {_s(title)}", fill=True,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(3)


def _confidence_line(pdf: _PDF, score: float) -> None:
    color = GREEN if score >= 0.7 else (ORANGE if score >= 0.4 else RED)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(*color)
    pdf.cell(0, 5, f"Confidence: {score * 100:.0f}%",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(1)


def _body(pdf: _PDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*BLACK)
    pdf.multi_cell(0, 5.5, _s(text))
    pdf.ln(1)


def _rule(pdf: _PDF) -> None:
    pdf.set_draw_color(*LIGHT)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)


def _citations(pdf: _PDF, citations: list[Citation]) -> None:
    if not citations:
        return
    pdf.ln(3)
    pdf.set_draw_color(*LIGHT)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*GREY)
    pdf.cell(0, 4, "SOURCES", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)
    for c in citations:
        date = f"  {c.filing_date}" if c.filing_date else ""
        label = _s(f"* {c.source}{date}")
        pdf.set_font("Helvetica", "", 8)
        if c.url:
            # Clickable link — underlined in blue
            pdf.set_text_color(*BLUE)
            pdf.cell(0, 4.5, label, link=c.url,
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            pdf.set_text_color(*GREY)
            pdf.cell(0, 4.5, label, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(3)


# ---------------------------------------------------------------------------
# Financial
# ---------------------------------------------------------------------------
def _financial_section(pdf: _PDF, f) -> None:
    _section_header(pdf, "Financial Analysis")
    _confidence_line(pdf, f.confidence_score)
    _body(pdf, f.summary)

    # Metric tables — 3-column layout
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
        col_w = (pdf.w - pdf.l_margin - pdf.r_margin - 6) / 3
        row_h = 5.5

        for i, (label, metrics) in enumerate(active):
            col = i % 3
            if col == 0:
                if i > 0:
                    pdf.ln(3)
                row_start_y = pdf.get_y()

            x = pdf.l_margin + col * (col_w + 3)
            y = row_start_y if col > 0 else pdf.get_y()
            pdf.set_xy(x, y)

            # Sub-header
            pdf.set_fill_color(*LIGHT)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*NAVY)
            pdf.cell(col_w, 6, _s(label.upper()), fill=True,
                     new_x=XPos.RIGHT, new_y=YPos.TOP)
            y += 6
            pdf.set_xy(x, y)

            # Data rows
            for m in sorted(metrics, key=lambda x: x.year, reverse=True):
                growth_str = ""
                if m.growth_rate is not None and m.growth_rate != 0:
                    sign = "+" if m.growth_rate > 0 else ""
                    growth_str = f"  {sign}{_pct(m.growth_rate)}"
                    g_color = GREEN if m.growth_rate >= 0 else RED
                else:
                    g_color = GREY

                pdf.set_xy(x, y)
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*GREY)
                pdf.cell(10, row_h, str(m.year))
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_text_color(*BLACK)
                pdf.cell(col_w - 30, row_h, _s(_usd(m.value)), align="R")
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*g_color)
                pdf.cell(20, row_h, _s(growth_str), align="R")
                y += row_h

        pdf.ln(5)

    # Key Ratios
    if f.key_ratios:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, "Key Ratios", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*BLACK)

        ratio_items = list(f.key_ratios.items())
        pill_w = 55
        x = pdf.l_margin
        for k, v in ratio_items:
            if x + pill_w > pdf.w - pdf.r_margin:
                pdf.ln(7)
                x = pdf.l_margin
            pdf.set_xy(x, pdf.get_y())
            pdf.set_fill_color(*LIGHT)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(pill_w, 6, _s(f"{k}: {v:.2f}"), fill=True, align="C")
            x += pill_w + 2
        pdf.ln(8)

    _citations(pdf, f.citations)


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------
def _risk_section(pdf: _PDF, r) -> None:
    _section_header(pdf, "Risk Analysis")
    _confidence_line(pdf, r.confidence_score)
    _body(pdf, r.summary)

    for risk in r.risks:
        sev = risk.severity.lower()
        color = SEVERITY_COLOR.get(sev, GREY)
        pdf.set_fill_color(*color)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(18, 5.5, _s(sev.upper()), fill=True, align="C")
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*BLACK)
        pdf.cell(0, 5.5, _s(f"  {risk.title}"),
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(60, 60, 60)
        pdf.multi_cell(0, 5, _s(risk.description))
        pdf.ln(2)

    _citations(pdf, r.citations)


# ---------------------------------------------------------------------------
# Market
# ---------------------------------------------------------------------------
def _market_section(pdf: _PDF, m) -> None:
    _section_header(pdf, "Market Analysis")
    _confidence_line(pdf, m.confidence_score)
    _body(pdf, m.summary)

    # TAM + market share boxes
    if m.market_size_usd or m.market_share:
        box_w = (pdf.w - pdf.l_margin - pdf.r_margin - 4) / 2
        y = pdf.get_y()
        for label, value in [
            ("Total Addressable Market", _usd(m.market_size_usd) if m.market_size_usd else None),
            ("Estimated Market Share",   _pct(m.market_share)    if m.market_share    else None),
        ]:
            if value is None:
                continue
            x = pdf.l_margin if label.startswith("Total") else pdf.l_margin + box_w + 4
            pdf.set_xy(x, y)
            pdf.set_fill_color(*LIGHT)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*GREY)
            pdf.cell(box_w, 5, _s(label), fill=True, new_x=XPos.LEFT, new_y=YPos.NEXT)
            pdf.set_xy(x, pdf.get_y())
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(*NAVY)
            pdf.cell(box_w, 9, _s(value), fill=True, align="C",
                     new_x=XPos.LEFT, new_y=YPos.NEXT)
        pdf.set_text_color(*BLACK)
        pdf.ln(5)

    # Competitors table
    if m.competitors:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, "Competitors", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        for c in m.competitors:
            share = f"  {_pct(c.estimated_market_share)} share" if c.estimated_market_share else ""
            pdf.set_fill_color(*LIGHT)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*BLACK)
            avail_w = pdf.w - pdf.l_margin - pdf.r_margin
            pdf.cell(avail_w - 30, 6, _s(f"  {c.name}"), fill=True)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*NAVY)
            pdf.cell(30, 6, _s(share), fill=True, align="R",
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(3)

    # Growth drivers + headwinds side by side
    half = (pdf.w - pdf.l_margin - pdf.r_margin - 4) / 2
    if m.growth_drivers or m.headwinds:
        top_y = pdf.get_y()

        if m.growth_drivers:
            pdf.set_xy(pdf.l_margin, top_y)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*GREEN)
            pdf.cell(half, 6, "GROWTH DRIVERS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*BLACK)
            for d in m.growth_drivers:
                pdf.set_x(pdf.l_margin)
                pdf.multi_cell(half, 4.5, _s(f"+ {d}"))
            drivers_end_y = pdf.get_y()
        else:
            drivers_end_y = top_y

        if m.headwinds:
            pdf.set_xy(pdf.l_margin + half + 4, top_y)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*RED)
            pdf.cell(half, 6, "HEADWINDS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            hw_y = top_y + 6
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*BLACK)
            for h in m.headwinds:
                pdf.set_xy(pdf.l_margin + half + 4, hw_y)
                pdf.multi_cell(half, 4.5, _s(f"- {h}"))
                hw_y = pdf.get_y()
            headwinds_end_y = pdf.get_y()
        else:
            headwinds_end_y = top_y

        pdf.set_y(max(drivers_end_y, headwinds_end_y))
        pdf.ln(3)

    _citations(pdf, m.citations)


# ---------------------------------------------------------------------------
# Legal
# ---------------------------------------------------------------------------
def _legal_section(pdf: _PDF, lg) -> None:
    _section_header(pdf, "Legal Analysis")
    _confidence_line(pdf, lg.confidence_score)
    _body(pdf, lg.summary)

    if lg.litigations:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, "Active Litigation", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)
        for lit in lg.litigations:
            pdf.set_fill_color(*LIGHT)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*BLACK)
            avail_w = pdf.w - pdf.l_margin - pdf.r_margin
            pdf.cell(avail_w - 28, 6, _s(lit.case_name), fill=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*GREY)
            pdf.cell(28, 6, _s(lit.status), fill=True, align="C",
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(60, 60, 60)
            pdf.multi_cell(0, 5, _s(lit.description))
            if lit.potential_liability_usd:
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(*RED)
                pdf.cell(0, 5,
                         f"  Potential liability: {_usd(lit.potential_liability_usd)}",
                         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_text_color(*BLACK)
            pdf.ln(2)

    if lg.regulatory_issues:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, "Regulatory Issues", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)
        for item in lg.regulatory_issues:
            agency = str(item.get("agency", "")) if item.get("agency") else ""
            desc   = str(item.get("description", ""))
            pdf.set_fill_color(255, 245, 230)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*BLACK)
            prefix = f"{agency}: " if agency else ""
            pdf.multi_cell(0, 5, _s(f"{prefix}{desc}"), fill=True)
            pdf.ln(1)

    _citations(pdf, lg.citations)
