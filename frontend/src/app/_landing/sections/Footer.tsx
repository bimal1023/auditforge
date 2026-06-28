import Link from "next/link";
import { Logo } from "@/components/Logo";

// Only link to things that actually exist. Misleading links (SOC 2, DPA,
// public API, customer logos, status page) are intentionally omitted until the
// underlying pages/products are real — a dead "SOC 2 report" link does more
// damage with institutional buyers than not listing it at all.
const FOOTER_COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Product",
    links: [
      ["Agents", "/#components"], ["Surfaces", "/#components"],
      ["How it works", "/#how"], ["The output", "/#output"],
      ["Pricing", "/#pricing"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Documentation", "/docs"], ["Methodology", "/methodology"], ["Security", "/security"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"], ["Careers", "/careers"],
      ["Contact", "mailto:bimalkumal2004@gmail.com"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms", "/terms"], ["Privacy", "/privacy"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="nav-brand">
              <span className="nav-brand-mark"><Logo variant="onDark" size={16} /></span>
              Arthvion
            </Link>
            <p>Institutional diligence, on demand. Built for analysts who need to be right, with the receipts to prove it.</p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="footer-col-title">{col.title}</div>
              <div className="footer-links">
                {col.links.map(([label, href]) =>
                  href.startsWith("/") && !href.startsWith("/#") ? (
                    <Link key={label} href={href}>{label}</Link>
                  ) : (
                    <a key={label} href={href}>{label}</a>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>© 2026 Arthvion · A research product, not investment advice.</span>
          <div className="links">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/security">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
