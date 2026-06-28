"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { IconSearch } from "../icons";

export function Nav() {
  const router = useRouter();

  // ⌘K / Ctrl-K jumps to the docs page (matches the badge in the search pill).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/docs");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="#" className="nav-brand">
          <span className="nav-brand-mark"><Logo variant="onDark" size={16} /></span>
          Arthvion
        </a>

        <div className="nav-links">
          <a href="#components" className="nav-link active">Product</a>
          <a href="#how"        className="nav-link">How it works</a>
          <a href="#output"     className="nav-link">The output</a>
          <a href="#pricing"    className="nav-link">Pricing</a>
          <Link href="/docs"    className="nav-link">Docs</Link>

          <Link
            href="/docs"
            className="nav-search"
            style={{ marginLeft: 12, textDecoration: "none" }}
            aria-label="Search the docs"
          >
            <IconSearch />
            <span style={{ flex: 1, color: "var(--n200)" }}>Search docs…</span>
            <span className="kbd">⌘K</span>
          </Link>

          <Link href="/login" className="btn btn-subtle">Sign in</Link>
          <a href="#cta" className="btn btn-primary">Get started</a>
        </div>
      </div>
    </nav>
  );
}
