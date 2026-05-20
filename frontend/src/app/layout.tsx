import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditForge — PE Due Diligence",
  description: "Multi-agent due diligence platform for private equity",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-brand-700">
              AuditForge
            </span>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              beta
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
