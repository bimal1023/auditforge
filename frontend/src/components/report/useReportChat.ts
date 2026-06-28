"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/auth";

export interface ChatSource {
  source: string;
  score: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

interface UseReportChat {
  messages: ChatMessage[];
  streaming: boolean;
  status: string | null;
  error: string | null;
  hydrating: boolean;
  send: (question: string) => Promise<void>;
  abort: () => void;
  reset: () => void;
  clear: () => Promise<void>;
}

/**
 * Drives the report chat: holds the conversation, POSTs the full history to
 * the streaming endpoint, and appends Server-Sent-Event deltas onto the
 * in-flight assistant message. The conversation is client-owned (Phase 1 has
 * no server-side persistence), so it resets when the report unmounts.
 */
export function useReportChat(reportId: string): UseReportChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Load any persisted conversation for this report on mount.
  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/reports/${reportId}/chat`);
        if (!res.ok) return;
        const rows: { role: "user" | "assistant"; content: string; sources?: ChatSource[] }[] =
          await res.json();
        if (!cancelled && Array.isArray(rows)) {
          setMessages(rows.map((r) => ({
            role: r.role,
            content: r.content,
            ...(r.sources?.length ? { sources: r.sources } : {}),
          })));
        }
      } catch {
        // Non-fatal — start with an empty conversation.
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportId]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setError(null);
  }, [abort]);

  const clear = useCallback(async () => {
    abort();
    setMessages([]);
    setError(null);
    try {
      await apiFetch(`/api/v1/reports/${reportId}/chat`, { method: "DELETE" });
    } catch {
      // Best-effort — the local conversation is already cleared.
    }
  }, [abort, reportId]);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || streaming) return;
      setError(null);

      // Optimistically render the user turn + an empty assistant turn we stream into.
      // Strip `sources` from history sent to the server — it only wants role/content.
      const history: ChatMessage[] = [...messages, { role: "user", content: q }];
      const wireHistory = history.map(({ role, content }) => ({ role, content }));
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);
      setStatus(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await apiFetch(`/api/v1/reports/${reportId}/chat`, {
          method: "POST",
          body: JSON.stringify({ messages: wireHistory }),
          signal: controller.signal,
        });

        if (res.status === 403) {
          setError("You need an analyst or admin role to ask questions in this workspace.");
          setMessages((prev) => prev.slice(0, -2)); // drop the optimistic user + assistant bubbles
          return;
        }
        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Parse the SSE byte stream line-by-line: events are separated by a
        // blank line; each carries one `data: <json>` payload.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? ""; // keep the trailing partial event

          for (const evt of events) {
            const line = evt.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let payload: {
              type: string; text?: string; message?: string; sources?: ChatSource[];
            };
            try {
              payload = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }

            if (payload.type === "status") {
              setStatus(payload.message ?? null);
            } else if (payload.type === "sources" && payload.sources) {
              const srcs = payload.sources;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, sources: srcs };
                }
                return next;
              });
            } else if (payload.type === "delta" && payload.text) {
              const chunk = payload.text;
              setStatus(null);
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: last.content + chunk };
                }
                return next;
              });
            } else if (payload.type === "error") {
              setError(payload.message ?? "Something went wrong.");
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("Connection lost. Please try again.");
          // Drop the trailing empty assistant bubble on hard failure.
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
            return prev;
          });
        }
      } finally {
        setStreaming(false);
        setStatus(null);
        abortRef.current = null;
      }
    },
    [messages, streaming, reportId],
  );

  return { messages, streaming, status, error, hydrating, send, abort, reset, clear };
}
