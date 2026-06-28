"""Generate Arthvion Go-To-Market Playbook PDF."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, ListFlowable, ListItem, KeepTogether,
)
from reportlab.lib import colors

# Brand colors
NAVY = HexColor("#091E42")
BLUE = HexColor("#0C66E4")
LIGHT_BLUE = HexColor("#E9F2FF")
GRAY = HexColor("#626F86")
LIGHT_GRAY = HexColor("#F8F9FB")
BORDER = HexColor("#DCDFE4")

OUTPUT_PATH = "/Users/bimalkumal/arthvion/Arthvion_GTM_Playbook.pdf"


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle", parent=styles["Title"],
        fontSize=28, leading=34, textColor=white,
        alignment=TA_CENTER, spaceAfter=12, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "CoverSub", parent=styles["Normal"],
        fontSize=14, leading=20, textColor=HexColor("#B3BAC5"),
        alignment=TA_CENTER, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "SectionTitle", parent=styles["Heading1"],
        fontSize=18, leading=24, textColor=NAVY,
        spaceBefore=24, spaceAfter=12, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "SubTitle", parent=styles["Heading2"],
        fontSize=14, leading=18, textColor=BLUE,
        spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "SubTitle2", parent=styles["Heading3"],
        fontSize=12, leading=16, textColor=NAVY,
        spaceBefore=12, spaceAfter=6, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10, leading=15, textColor=HexColor("#172B4D"),
        alignment=TA_JUSTIFY, spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "EmailSubject", parent=styles["Normal"],
        fontSize=10, leading=14, textColor=NAVY,
        fontName="Helvetica-Bold", spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "EmailBody", parent=styles["Normal"],
        fontSize=9.5, leading=14, textColor=HexColor("#44546F"),
        leftIndent=12, spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "BulletItem", parent=styles["Normal"],
        fontSize=10, leading=15, textColor=HexColor("#172B4D"),
        leftIndent=20, bulletIndent=8, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "PageNum", parent=styles["Normal"],
        fontSize=8, textColor=GRAY, alignment=TA_CENTER,
    ))
    return styles


def add_page_number(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(GRAY)
    canvas_obj.drawCentredString(letter[0] / 2, 30, f"Arthvion GTM Playbook  |  Page {doc.page}")
    canvas_obj.restoreState()


def cover_page(canvas_obj, doc):
    w, h = letter
    # Dark background
    canvas_obj.setFillColor(NAVY)
    canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)
    # Accent bar
    canvas_obj.setFillColor(BLUE)
    canvas_obj.rect(0, h - 8, w, 8, fill=1, stroke=0)


def make_table(data, col_widths=None, header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    style_cmds = [
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), HexColor("#172B4D")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
    ]
    if header:
        style_cmds += [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ]
    # Alternate row colors
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GRAY))
    t.setStyle(TableStyle(style_cmds))
    return t


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )
    s = build_styles()
    story = []

    # ── Cover Page ─────────────────────────────────────────────────────────
    story.append(Spacer(1, 180))
    story.append(Paragraph("ARTHVION", s["CoverTitle"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Go-To-Market Playbook", s["CoverTitle"]))
    story.append(Spacer(1, 20))
    story.append(Paragraph("Getting Your First 10 Clients", s["CoverSub"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph("AI-Powered PE Due Diligence in 2 Minutes", s["CoverSub"]))
    story.append(PageBreak())

    # ── Strategy Overview ──────────────────────────────────────────────────
    story.append(Paragraph("Strategy Overview", s["SectionTitle"]))
    story.append(Paragraph(
        "Your ideal first customers are <b>mid-market PE firms (Fund II-IV, $200M-$2B AUM)</b> with "
        "3-15 investment professionals. They are big enough to feel the pain of slow diligence but "
        "small enough that one champion can push a tool through without a 6-month procurement process.",
        s["Body"]
    ))
    story.append(Paragraph(
        "The goal: <b>Get 1 person to use Arthvion on a real deal.</b> Once they see their 80-hour "
        "process done in 2 minutes on something they actually care about, they will never go back. "
        "Every channel below exists to get you to that moment.",
        s["Body"]
    ))
    story.append(Spacer(1, 12))

    # ── Channel 1: Cold Email ─────────────────────────────────────────────
    story.append(Paragraph("Channel 1: Cold Email Outreach", s["SectionTitle"]))
    story.append(Paragraph("Target Personas", s["SubTitle"]))

    personas_data = [
        ["Role", "Why They Care", "Where to Find"],
        ["VP / Principal", "Owns deal throughput, accountable for pipeline velocity", "LinkedIn, firm websites"],
        ["Head of Research", "Directly feels the bottleneck, controls tooling budget", "LinkedIn, Preqin"],
        ["Associate / Sr Associate", "Daily user, will champion internally if it saves 10hrs/week", "LinkedIn, PE events"],
    ]
    story.append(make_table(personas_data, col_widths=[1.5*inch, 3*inch, 2.5*inch]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("How to Build Your List", s["SubTitle"]))
    list_items = [
        "<b>LinkedIn Sales Navigator</b> - Filter: Private Equity + VP/Principal/Associate + headcount 5-50",
        "<b>Preqin / PitchBook free tier</b> - Get firm names, fund sizes, sectors",
        "<b>SEC EDGAR Form D filings</b> - Shows who just raised a fund (actively deploying = actively doing diligence)",
        "<b>AngelList / Crunchbase</b> - Growth equity and late-stage VC firms also do heavy diligence",
    ]
    for item in list_items:
        story.append(Paragraph(f"•  {item}", s["BulletItem"]))
    story.append(Spacer(1, 12))

    # Email sequence
    story.append(Paragraph("5-Email Sequence (14 Days)", s["SubTitle"]))

    # Email 1
    story.append(Paragraph("Email 1: The Hook (Day 1)", s["SubTitle2"]))
    story.append(Paragraph("Subject: Your associates are spending 80 hours on work that takes 2 minutes", s["EmailSubject"]))
    story.append(Paragraph(
        "Hi [First Name],<br/><br/>"
        "I noticed [Firm Name] closed [Deal/Fund Name] recently - congrats.<br/><br/>"
        "Quick question: how many hours does your team spend on the initial diligence memo before "
        "an investment committee meeting?<br/><br/>"
        "We built Arthvion - it deploys 4 AI research agents that produce a full due diligence report "
        "(financials, risk, market, legal) in under 2 minutes. Every claim is cited from primary sources "
        "(SEC filings, litigation databases, earnings transcripts).<br/><br/>"
        "Not a chatbot. Not a summary tool. A structured IC-ready memo with confidence scores.<br/><br/>"
        "Would you be open to a 15-minute demo? I can run a live report on any company in your pipeline.<br/><br/>"
        "Best,<br/>[Your Name]<br/><br/>"
        "P.S. Here is a sample report we generated on [well-known company]: [link]",
        s["EmailBody"]
    ))

    # Email 2
    story.append(Paragraph("Email 2: The Value Drop (Day 3)", s["SubTitle2"]))
    story.append(Paragraph("Subject: Re: Your associates are spending 80 hours on work that takes 2 minutes", s["EmailSubject"]))
    story.append(Paragraph(
        "Hi [First Name],<br/><br/>"
        "Wanted to share something concrete - I ran Arthvion on [company in their portfolio].<br/><br/>"
        "Key findings in 2 minutes:<br/>"
        "• 3 material litigation risks flagged that were not in the 10-K summary<br/>"
        "• Revenue concentration: top 3 customers = 61% of revenue<br/>"
        "• Confidence score: 0.87 across all sections<br/><br/>"
        "Full report attached. Every data point traced back to source.<br/><br/>"
        "Worth 15 minutes of your time to see it live?<br/><br/>"
        "Best,<br/>[Your Name]",
        s["EmailBody"]
    ))

    story.append(PageBreak())

    # Email 3
    story.append(Paragraph("Email 3: Social Proof / Scarcity (Day 7)", s["SubTitle2"]))
    story.append(Paragraph("Subject: How [peer firm type] is cutting diligence time by 90%", s["EmailSubject"]))
    story.append(Paragraph(
        "Hi [First Name],<br/><br/>"
        "One thing I am hearing from funds like yours: the bottleneck is not deal flow - it is the "
        "throughput to evaluate them fast enough.<br/><br/>"
        "We are onboarding 10 design partners this quarter for our Desk plan ($399/seat/month, "
        "unlimited team collaboration). Each firm gets:<br/>"
        "• Direct input on our product roadmap<br/>"
        "• Custom data source integrations<br/>"
        "• Priority support<br/><br/>"
        "Given [Firm Name]'s focus on [their sector], I think you would find the [sector-relevant agent] "
        "particularly sharp.<br/><br/>"
        "Open to a quick call this week?<br/><br/>"
        "[Your Name]",
        s["EmailBody"]
    ))

    # Email 4
    story.append(Paragraph("Email 4: The Breakup (Day 10)", s["SubTitle2"]))
    story.append(Paragraph("Subject: Should I close your file?", s["EmailSubject"]))
    story.append(Paragraph(
        "Hi [First Name],<br/><br/>"
        "I have reached out a couple times about cutting your diligence time from weeks to minutes. "
        "Totally understand if the timing is off.<br/><br/>"
        "If this is not relevant right now, just say \"not now\" and I will follow up in 6 months. "
        "No hard feelings.<br/><br/>"
        "But if your team is still spending 80+ hours per memo and you would rather spend 2 minutes, "
        "I would love 15 minutes to show you how.<br/><br/>"
        "Either way - good luck with the fund.<br/><br/>"
        "[Your Name]",
        s["EmailBody"]
    ))

    # Email 5
    story.append(Paragraph("Email 5: The Referral (Day 14)", s["SubTitle2"]))
    story.append(Paragraph("Subject: Quick favor?", s["EmailSubject"]))
    story.append(Paragraph(
        "Hi [First Name],<br/><br/>"
        "Looks like this might not be the right time for you - totally fair.<br/><br/>"
        "Quick ask: is there someone on your team (maybe your Head of Research or a senior associate) "
        "who would be the right person to evaluate new diligence tools? Happy to reach out to them "
        "directly so I am not clogging your inbox.<br/><br/>"
        "Thanks either way,<br/>[Your Name]",
        s["EmailBody"]
    ))
    story.append(Spacer(1, 12))

    # ── Channel 2: LinkedIn ───────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Channel 2: LinkedIn Content + DMs", s["SectionTitle"]))
    story.append(Paragraph("Content Strategy (Post 3-5x/week)", s["SubTitle"]))

    linkedin_data = [
        ["Day", "Post Type", "Example Topic"],
        ["Monday", "Hot take", "\"PE associates aren't slow. The process is slow. 200-page 10-K with 1994 workflows.\""],
        ["Tuesday", "Behind-the-scenes", "Ship a feature, show a screenshot, explain why it matters for PE teams"],
        ["Wednesday", "Data / insight", "\"We analyzed 500 SEC filings. Average 10-K has 47 risk factors. Only 3-5 are material.\""],
        ["Thursday", "Customer story", "\"A fund told me they pass on 3 deals/month because memos take too long.\""],
        ["Friday", "Product demo clip", "30-second screen recording showing a report generating in real-time"],
    ]
    story.append(make_table(linkedin_data, col_widths=[1.2*inch, 1.8*inch, 4*inch]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("DM Template (After They Engage With Your Content)", s["SubTitle"]))
    story.append(Paragraph(
        "Hey [Name] - saw you liked my post about [topic]. Quick question: does your team still do "
        "the initial diligence memo manually, or are you using any tooling for that?<br/><br/>"
        "We built something that generates a full IC-ready memo in 2 minutes (cited from SEC filings + "
        "litigation databases). Happy to run one on a company in your pipeline if you are curious - "
        "no strings attached.",
        s["EmailBody"]
    ))
    story.append(Spacer(1, 12))

    # ── Channel 3: Warm Intros ────────────────────────────────────────────
    story.append(Paragraph("Channel 3: Warm Intros via PE Networks", s["SectionTitle"]))
    story.append(Paragraph("Where to Find Warm Intros", s["SubTitle"]))

    intros_items = [
        "<b>PE/VC conferences</b> - ACG DealMAX, SuperReturn, PEI events",
        "<b>University alumni networks</b> - Wharton, HBS, Columbia PE/VC clubs",
        "<b>Operating partner networks</b> - EIRs evaluating tools for portfolio",
        "<b>Fund administrators</b> - They serve 50+ funds, can make introductions",
        "<b>Placement agents</b> - Know who just raised and is actively deploying",
    ]
    for item in intros_items:
        story.append(Paragraph(f"•  {item}", s["BulletItem"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Intro Request Template", s["SubTitle"]))
    story.append(Paragraph("Subject: Quick intro request - [Firm Name]", s["EmailSubject"]))
    story.append(Paragraph(
        "Hey [Connector],<br/><br/>"
        "I am building Arthvion - an AI platform that does PE due diligence in 2 minutes instead of "
        "2 weeks. We deploy AI agents that pull from SEC EDGAR, litigation databases, and earnings "
        "transcripts to produce cited, IC-ready memos.<br/><br/>"
        "I noticed you are connected to [Target Person] at [Firm Name]. Given their focus on "
        "[sector/strategy], I think this could save their deal team serious time.<br/><br/>"
        "Would you be open to a quick double-opt-in intro? Happy to send you a blurb they can review "
        "before deciding.<br/><br/>"
        "Thanks!<br/>[Your Name]",
        s["EmailBody"]
    ))

    # ── Channel 4: Free Value ─────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Channel 4: Free Value First (Product-Led)", s["SectionTitle"]))
    story.append(Paragraph("The \"Free Diligence Report\" Play", s["SubTitle"]))
    story.append(Paragraph(
        "This is your highest-conversion play. It gives immediate value on a company they actually care about.",
        s["Body"]
    ))

    free_steps = [
        "Identify 50 firms that just announced a deal (press releases, PitchBook alerts)",
        "Run Arthvion on the target company",
        "Send the firm a personalized email with the report attached",
    ]
    for i, step in enumerate(free_steps, 1):
        story.append(Paragraph(f"<b>Step {i}:</b> {step}", s["BulletItem"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Sample Email", s["SubTitle2"]))
    story.append(Paragraph("Subject: I ran a diligence report on [Target Company] for you", s["EmailSubject"]))
    story.append(Paragraph(
        "Hi [Name],<br/><br/>"
        "Saw that [Firm Name] is looking at [Target Company] (congrats on the deal flow).<br/><br/>"
        "I ran our AI diligence platform on them - attached is a full report covering financials, "
        "risk factors, market position, and legal exposure. Every claim is cited.<br/><br/>"
        "Two things jumped out:<br/>"
        "• [Specific finding #1]<br/>"
        "• [Specific finding #2]<br/><br/>"
        "This took 2 minutes to generate. Your team can run unlimited reports on our platform - "
        "happy to set you up with a trial.<br/><br/>"
        "Worth a quick call?<br/><br/>"
        "[Your Name]",
        s["EmailBody"]
    ))

    # ── Channel 5: Community ──────────────────────────────────────────────
    story.append(Spacer(1, 12))
    story.append(Paragraph("Channel 5: Community & Content", s["SectionTitle"]))
    story.append(Paragraph("\"The 2-Minute Memo\" Newsletter", s["SubTitle"]))
    story.append(Paragraph(
        "A weekly email to PE professionals: pick a public company in the news, run Arthvion on it, "
        "share 3 key findings + confidence score, link to the full report (gated behind email signup). "
        "This builds an email list of qualified PE professionals, proves the product works on real "
        "companies, and generates SEO + backlinks.",
        s["Body"]
    ))

    story.append(Paragraph("Guest Posts / Podcasts", s["SubTitle"]))
    media_data = [
        ["Outlet", "Angle"],
        ["PE Hub", "\"How AI Is Changing the Speed of Due Diligence\""],
        ["Institutional Investor", "\"The Associate-Hour Problem: Why PE Firms Can't Scale\""],
        ["The Twenty Minute VC", "\"Building AI Tools for Private Equity\""],
        ["Acquired (podcast)", "\"The Unsexy $12B Market No One Is Automating\""],
    ]
    story.append(make_table(media_data, col_widths=[2.5*inch, 4.5*inch]))

    # ── Channel 6: Partnerships ───────────────────────────────────────────
    story.append(Spacer(1, 12))
    story.append(Paragraph("Channel 6: Strategic Partnerships", s["SectionTitle"]))

    partner_data = [
        ["Partner Type", "What You Offer", "What You Get"],
        ["Law firms (M&A)", "White-label diligence reports", "Deal flow + intros to PE clients"],
        ["Fund administrators", "Integration with their portal", "Distribution to 50+ funds"],
        ["Placement agents", "Free tool for fundraising decks", "Intros to GPs who just raised"],
        ["MBA programs", "Free academic licenses", "Associates who bring you into PE firms"],
    ]
    story.append(make_table(partner_data, col_widths=[2*inch, 2.5*inch, 2.5*inch]))

    # ── Launch Checklist ──────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Full Launch Checklist (8 Weeks)", s["SectionTitle"]))

    story.append(Paragraph("Week 1-2: Foundation", s["SubTitle"]))
    w12 = [
        "Build a landing page with a live demo (let visitors run 1 free report)",
        "Record a 90-second product video (screen recording + voiceover)",
        "Create 3 sample reports on well-known companies (Apple, Stripe, SpaceX)",
        "Set up email infrastructure (custom domain, warm up for 2 weeks)",
        "Build a list of 200 target contacts (LinkedIn Sales Navigator)",
    ]
    for item in w12:
        story.append(Paragraph(f"•  {item}", s["BulletItem"]))

    story.append(Paragraph("Week 3-4: Outreach", s["SubTitle"]))
    w34 = [
        "Send Email 1 to first 50 contacts",
        "Post on LinkedIn daily",
        "DM 10 people per day who engage with PE content",
        "Ask 5 friends/advisors for warm intros",
        "Run the \"free report\" play on 10 firms with active deals",
    ]
    for item in w34:
        story.append(Paragraph(f"•  {item}", s["BulletItem"]))

    story.append(Paragraph("Week 5-6: Convert", s["SubTitle"]))
    w56 = [
        "Follow up religiously (Email 2-5 sequence)",
        "Offer 14-day free trial of Desk plan to anyone who takes a demo",
        "Get 3 design partners committed (even at a discount)",
        "Collect testimonials from early users",
        "Start the newsletter with your first issue",
    ]
    for item in w56:
        story.append(Paragraph(f"•  {item}", s["BulletItem"]))

    story.append(Paragraph("Week 7-8: Scale What Works", s["SubTitle"]))
    w78 = [
        "Double down on the channel that got your first 3 meetings",
        "Ask early users for referrals (\"Who else on your team should see this?\")",
        "Apply to PE-focused accelerators (Foresight, Endeavor)",
        "Start YC application with real traction numbers",
    ]
    for item in w78:
        story.append(Paragraph(f"•  {item}", s["BulletItem"]))
    story.append(Spacer(1, 16))

    # ── Metrics ───────────────────────────────────────────────────────────
    story.append(Paragraph("Metrics to Track (First 60 Days)", s["SectionTitle"]))

    metrics_data = [
        ["Metric", "Target"],
        ["Emails sent", "500+"],
        ["Reply rate", "15-25% (cold email to PE)"],
        ["Demos booked", "20+"],
        ["Free trials started", "10+"],
        ["Paid conversions", "3-5 (first $5-10K MRR)"],
        ["LinkedIn followers gained", "500+"],
        ["Newsletter subscribers", "200+"],
    ]
    story.append(make_table(metrics_data, col_widths=[3*inch, 4*inch]))
    story.append(Spacer(1, 20))

    # ── The One Thing ─────────────────────────────────────────────────────
    story.append(Paragraph("The One Thing That Matters Most", s["SectionTitle"]))
    story.append(Paragraph(
        "<b>Get 1 person to use it on a real deal.</b> Not a demo. Not a sample. A real company they "
        "are actually evaluating. Once they see their 80-hour process done in 2 minutes - on something "
        "they care about - they will never go back. That is your conversion moment.",
        s["Body"]
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Everything else (emails, content, partnerships) exists to get you to that moment.",
        s["Body"]
    ))
    story.append(Spacer(1, 24))
    story.append(Paragraph(
        "<i>\"Every PE firm has the same problem: too many deals, not enough hours. We turn due diligence "
        "from a 2-week bottleneck into a 2-minute workflow. We are not replacing the investor's judgment - "
        "we are giving them the material 10x faster so they can actually use it.\"</i>",
        s["Body"]
    ))

    # Build with custom first page and subsequent page templates
    doc.build(story, onFirstPage=cover_page, onLaterPages=add_page_number)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
