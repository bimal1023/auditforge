import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditForge — PE Due Diligence",
  description: "Multi-agent due diligence platform for private equity",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
