"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ArrowRight, MessageSquare, UserPlus, Activity, Layers, Upload, Star, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import type { ActivityEventItem } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  report_created: <FileText size={14} />,
  report_completed: <FileText size={14} />,
  deal_created: <Layers size={14} />,
  deal_stage_changed: <ArrowRight size={14} />,
  comment_added: <MessageSquare size={14} />,
  member_joined: <UserPlus size={14} />,
  deal_deleted: <Trash2 size={14} />,
  document_uploaded: <Upload size={14} />,
  watchlist_added: <Star size={14} />,
};

const EVENT_COLORS: Record<string, string> = {
  report_created: "var(--b100, #E9F2FF)",
  report_completed: "var(--g100, #DCFFF1)",
  deal_created: "var(--p100, #F3E8FF)",
  deal_stage_changed: "var(--p100, #F3E8FF)",
  deal_deleted: "var(--r100, #FFECEB)",
  comment_added: "var(--t100, #E3FAFC)",
  member_joined: "var(--y100, #FFF7D6)",
  document_uploaded: "var(--t100, #E3FAFC)",
  watchlist_added: "var(--y100, #FFF7D6)",
};

const EVENT_ICON_COLORS: Record<string, string> = {
  report_created: "var(--b700, #0055CC)",
  report_completed: "var(--g700, #216E4E)",
  deal_created: "var(--p700, #5E4DB2)",
  deal_stage_changed: "var(--p700, #5E4DB2)",
  deal_deleted: "var(--r700, #AE2A19)",
  comment_added: "var(--t700, #206A83)",
  member_joined: "var(--y700, #7F5F01)",
  document_uploaded: "var(--t700, #206A83)",
  watchlist_added: "var(--y700, #7F5F01)",
};

export default function WorkspaceActivityFeed() {
  const [events, setEvents] = useState<ActivityEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchEvents = useCallback(async (before?: string) => {
    try {
      let url = "/api/v1/activity?limit=50";
      if (before) url += `&before=${encodeURIComponent(before)}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data: ActivityEventItem[] = await res.json();
        if (before) {
          setEvents((prev) => [...prev, ...data]);
        } else {
          setEvents(data);
        }
        setHasMore(data.length === 50);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function loadMore() {
    if (events.length > 0) {
      fetchEvents(events[events.length - 1].created_at);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--n400, #8590A2)", fontSize: 13 }}>
        Loading activity...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Activity size={32} style={{ margin: "0 auto 12px", color: "var(--n300, #B3BAC5)" }} />
        <p style={{ fontSize: 14, color: "var(--n500, #626F86)", margin: 0 }}>
          No workspace activity yet. Start by running a report or adding deals!
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 680, margin: "0 auto" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--n900, #091E42)", margin: "0 0 20px" }}>
        Workspace Activity
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {events.map((ev, i) => (
          <div
            key={ev.id}
            style={{
              display: "flex", gap: 12, padding: "12px 0",
              borderBottom: i < events.length - 1 ? "1px solid var(--n100, #F1F2F4)" : "none",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: EVENT_COLORS[ev.event_type] || "var(--n50, #F4F5F7)",
              color: EVENT_ICON_COLORS[ev.event_type] || "var(--n600, #44546F)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {EVENT_ICONS[ev.event_type] || <Activity size={14} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--n800, #172B4D)", lineHeight: 1.5 }}>
                {ev.summary}
              </p>
              <span style={{ fontSize: 11, color: "var(--n400, #8590A2)" }}>
                {timeAgo(ev.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={loadMore}
          style={{
            display: "block", margin: "16px auto 0", padding: "8px 20px",
            fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
            border: "1px solid var(--n200, #DCDFE4)", background: "#fff",
            color: "var(--n600, #44546F)",
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
