import type { Metadata } from "next";

import { CSS } from "./_landing/css";
import { Nav } from "./_landing/sections/Nav";
import { Hero } from "./_landing/sections/Hero";
import { Components } from "./_landing/sections/Components";
import { HowItWorks } from "./_landing/sections/HowItWorks";
import { Output } from "./_landing/sections/Output";
import { Pricing } from "./_landing/sections/Pricing";
import { CTA } from "./_landing/sections/CTA";
import { Footer } from "./_landing/sections/Footer";

export const metadata: Metadata = {
  title: "Arthvion — Institutional diligence, on demand",
  description:
    "Four specialist agents synthesise SEC filings, market intelligence, and litigation records into an investment-grade memo with citations.",
};

export default function LandingPage() {
  return (
    <>
      {/* Google Fonts (hoisted into <head> by React 18) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="lp-wrap">
        <Nav />
        <Hero />
        <Components />
        <HowItWorks />
        <Output />
        <Pricing />
        <CTA />
        <Footer />
      </div>
    </>
  );
}
