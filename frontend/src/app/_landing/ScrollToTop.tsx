"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Forces the viewport to the top whenever the route changes.
 *  Next's App Router is supposed to do this on navigation, but it's unreliable
 *  when consecutive pages share the same layout/structure — landing footer →
 *  content page can leave you scrolled to the bottom. This guarantees the top. */
export function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
