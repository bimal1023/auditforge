import { IconInfo } from "../icons";

const OUTPUT_KEYS = [
  { n: "01", text: <><b>Every claim is citable.</b> Hover any superscript to jump to the source paragraph in the underlying filing.</> },
  { n: "02", text: <><b>Conviction, not vibes.</b> The 0–10 score is the synthesis agent&rsquo;s calibrated output, with confidence intervals shown on hover.</> },
  { n: "03", text: <><b>Adversarial review built in.</b> Each finding is cross-checked against the strongest opposing source before it lands in the memo.</> },
  { n: "04", text: <><b>Exportable.</b> Print to PDF in-app, or download a typed JSON payload for downstream tooling.</> },
];

const SEGMENT_ROWS: [string, string, string, string, string, boolean][] = [
  ["iPhone",            "200.6", "201.9", "+0.6%",  "52%", false],
  ["Services",          "85.2",  "99.1",  "+16.3%", "26%", false],
  ["Mac",               "29.4",  "29.9",  "+1.7%",  "8%",  false],
  ["iPad",              "28.3",  "25.1",  "−11.3%", "7%",  true],
  ["Wearables & Other", "39.8",  "37.0",  "−7.0%",  "7%",  true],
];

export function Output() {
  return (
    <section className="output" id="output">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">The output</span>
          <h2>An analyst-grade memo, every time.</h2>
          <p className="lead">
            Not a summary. Not a bulleted blob. A real investment memo with structure, evidence, and a single defensible conclusion.
          </p>
        </div>

        <div className="output-grid">
          <aside className="output-side">
            <div className="output-tabs">
              {["Memo", "PDF", "JSON"].map((t) => (
                <button key={t} className={`output-tab${t === "Memo" ? " active" : ""}`}>
                  {t}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "var(--fs-small)", color: "var(--n300)", lineHeight: 1.6, margin: "0 0 var(--s-300)" }}>
              The default deliverable. Eight pages, structured: thesis, financial picture, risk register, market position, legal exposure, and a defended conviction score.
            </p>
            <div className="output-keys">
              {OUTPUT_KEYS.map((k) => (
                <div className="output-key" key={k.n}>
                  <span className="output-key-num">{k.n}</span>
                  <div className="output-key-text">{k.text}</div>
                </div>
              ))}
            </div>
          </aside>

          <article className="doc">
            <div className="doc-header">
              <div className="doc-title">
                <h3>Apple Inc.</h3>
                <div className="sub">
                  <span className="ticker">AAPL</span>
                  <span>NASDAQ · Large Cap · Consumer Electronics</span>
                </div>
              </div>
              <div className="doc-score-mini">
                <span className="num tnum">7.4</span>
                <span>/ 10 · Buy</span>
              </div>
            </div>

            <div className="doc-section">
              <div className="doc-eyebrow">§ 1 · Thesis</div>
              <h4 className="doc-h">Services moat continues to compound on a healthy hardware base.</h4>
              <p className="doc-p">
                Apple&apos;s services segment grew 16.3% YoY to $24.2B, now 28% of total revenue<sup>3</sup>,
                with gross margin expanding 280 basis points to 74.0%<sup>4</sup>. The services flywheel is
                increasingly compounding on the installed base rather than on net-new hardware units<sup>7</sup>.
              </p>
              <div className="doc-callout">
                <IconInfo />
                <div>
                  <b>Cross-check:</b> The 16.3% YoY services figure reconciles to{" "}
                  <a href="#">10-Q § Item 1</a>, and is corroborated by the{" "}
                  <a href="#">FY24 Q3 earnings transcript</a>.
                </div>
              </div>
            </div>

            <div className="doc-section">
              <div className="doc-eyebrow">§ 2 · Segment trajectory</div>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Segment</th><th>FY23</th><th>FY24E</th>
                    <th className="mono">YoY</th><th className="mono">Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {SEGMENT_ROWS.map(([seg, fy23, fy24, yoy, mix, neg]) => (
                    <tr key={seg}>
                      <td>{seg}</td>
                      <td className="mono">{fy23}</td>
                      <td className="mono">{fy24}</td>
                      <td className={`ch${neg ? " neg" : ""}`}>{yoy}</td>
                      <td className="mono">{mix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="doc-section">
              <div className="doc-eyebrow">§ 3 · Key risks</div>
              <p className="doc-p">
                Two material risks dominate. <b>Antitrust:</b> the DOJ&apos;s pending action targets the
                App Store revenue model directly<sup>22</sup>; remedy outcomes could compress services
                margin by 200–400 bps in the bear case<sup>24</sup>. <b>China concentration:</b> Greater
                China still represents 17% of revenue<sup>30</sup>, with iPhone unit softness in the region
                partially offset by services subscription growth<sup>33</sup>.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
