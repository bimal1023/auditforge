"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./auth";

export interface CreditsState {
  /** Current memo balance for the authenticated user. `null` while loading. */
  credits: number | null;
  /** "solo" | "desk" | "firm" — informational; the actual cap comes from `credits`. */
  planTier: string;
  /** Re-fetches `/auth/me` and updates state. Call after a successful run. */
  refresh: () => Promise<void>;
}

/**
 * Subscribes to the current user's credit balance.
 *
 * Reads `GET /api/v1/auth/me` and exposes `credits`, `planTier`, and a
 * `refresh()` action. Components should call `refresh()` after each
 * successful report run so the displayed balance stays in sync without a
 * full page reload.
 */
export function useCredits(): CreditsState {
  const [credits,  setCredits]  = useState<number | null>(null);
  const [planTier, setPlanTier] = useState<string>("solo");

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/auth/me");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.memo_credits === "number") setCredits(data.memo_credits);
      if (typeof data?.plan_tier === "string")    setPlanTier(data.plan_tier);
    } catch {
      // Silently ignore — keeps last known value so the UI doesn't flicker
      // on transient network blips.
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { credits, planTier, refresh };
}
