"use client";

import { Suspense } from "react";
import { CSS } from "./css";
import { BrandPanel } from "./components/BrandPanel";
import { AuthForm } from "./components/AuthForm";

export default function LoginPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lp-login" style={{ overflow: "hidden" }}>
        <BrandPanel />
        {/* AuthForm reads the ?next= param via useSearchParams(), which Next.js 15
            requires to sit inside a Suspense boundary for the static prerender. */}
        <Suspense fallback={null}>
          <AuthForm />
        </Suspense>
      </div>
    </>
  );
}
