"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, MessageSquare, Check } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import type { NotificationItem } from "@/lib/types";

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

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate?: (targetType: string, targetId: string) => void;
}

export default function NotificationsDropdown({ open, onClose, onNavigate }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/notifications?limit=20");
      if (res.ok) setNotifications(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!unread.length) return;
    await apiFetch("/api/v1/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ ids: unread }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleClick(n: NotificationItem) {
    if (n.comment_target_type && n.comment_target_id && onNavigate) {
      onNavigate(n.comment_target_type, n.comment_target_id);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 998 }}
      />
      {/* Panel */}
      <div style={{
        position: "absolute", top: 44, right: 0, zIndex: 999,
        width: 360, maxHeight: 420, overflowY: "auto",
        background: "#fff", borderRadius: 8, border: "1px solid var(--n200, #DCDFE4)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid var(--n100, #F1F2F4)",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n900, #091E42)" }}>
            Notifications
          </span>
          <button
            onClick={markAllRead}
            style={{
              fontSize: 11, fontWeight: 600, color: "var(--b600, #0C66E4)",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Check size={12} /> Mark all read
          </button>
        </div>

        {loading && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--n400)" }}>
            Loading...
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--n400, #8590A2)" }}>
            <Bell size={20} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            <p style={{ margin: 0 }}>No notifications</p>
          </div>
        )}

        {!loading && notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => handleClick(n)}
            style={{
              display: "flex", gap: 10, padding: "10px 16px", cursor: "pointer",
              background: n.read ? "transparent" : "var(--b50, #F7FAFF)",
              borderBottom: "1px solid var(--n50, #F4F5F7)",
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
              background: "var(--t100, #E3FAFC)", color: "var(--t700, #206A83)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MessageSquare size={12} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--n800, #172B4D)", lineHeight: 1.4 }}>
                <strong>{n.author_name || n.author_email || "Someone"}</strong>
                {" mentioned you: "}
                <span style={{ color: "var(--n600, #44546F)" }}>
                  {n.comment_preview || ""}
                </span>
              </p>
              <span style={{ fontSize: 11, color: "var(--n400, #8590A2)" }}>
                {timeAgo(n.created_at)}
              </span>
            </div>
            {!n.read && (
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: "var(--b600, #0C66E4)", marginTop: 6,
              }} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
