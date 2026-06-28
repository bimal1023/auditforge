import { IconBolt, IconCheck, IconClock, IconSynthesis } from "../icons";

const STEPS = [
  {
    n: "01", title: "Brief", icon: <IconClock />, time: "< 30s",
    desc: "Type a company, paste a ticker, or import from your watchlist. Add an optional thesis to steer the agents.",
  },
  {
    n: "02", title: "Dispatch", icon: <IconBolt size={11} />, time: "streams live",
    desc: "Four agents fan out in parallel against SEC, market, legal, and risk sources. Progress streams live.",
  },
  {
    n: "03", title: "Synthesise", icon: <IconSynthesis />, time: "auto",
    desc: "A synthesis pass reconciles the four outputs, scores conviction 0–10, and writes the final memo with citations.",
  },
  {
    n: "04", title: "Review & ship", icon: <IconCheck size={11} />, time: "Your turn",
    desc: "Read the memo in-app, share it with your team for comments, or export to PDF — every citation included.",
  },
];

export function HowItWorks() {
  return (
    <section
      className="section section-tight"
      id="how"
      style={{
        background: "var(--n10)",
        borderTop: "1px solid var(--n30)",
        borderBottom: "1px solid var(--n30)",
      }}
    >
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>Brief once. Dispatch four agents.</h2>
          <p className="lead">
            The same workflow your firm runs already, compressed into the time it takes to read a CIM cover page.
          </p>
        </div>

        <div className="how-row">
          {STEPS.map((s) => (
            <div className="how-step" key={s.n}>
              <span className="how-step-num">{s.n}</span>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
              <span className="meta">{s.icon}{s.time}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
