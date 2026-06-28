"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Pencil, Trash2, X, Check } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import type { CommentItem } from "@/lib/types";

interface Props {
  targetType: "report" | "deal";
  targetId: string;
}

interface MemberInfo {
  email: string;
  name: string | null;
  role: string;
}

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

function initials(email: string, name: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("").slice(0, 2);
  }
  return email[0]?.toUpperCase() || "?";
}

export default function CommentsPanel({ targetType, targetId }: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // @mention autocomplete state
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);

  // Fetch workspace members once for @mention
  useEffect(() => {
    apiFetch("/api/v1/team/members")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(data.map((m: { email: string; full_name?: string; name?: string; role: string }) => ({
            email: m.email,
            name: m.full_name || m.name || null,
            role: m.role,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const fetchComments = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/v1/comments?target_type=${targetType}&target_id=${targetId}`
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch { /* ignore */ }
  }, [targetType, targetId]);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 8000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments.length]);

  // Detect @ trigger in input
  function handleBodyChange(value: string) {
    setBody(value);

    // Check if we're in a @mention context
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");

    if (atIdx >= 0 && (atIdx === 0 || textBeforeCursor[atIdx - 1] === " ")) {
      const query = textBeforeCursor.slice(atIdx + 1);
      // Only show if no space in the query (user is still typing the mention)
      if (!query.includes(" ")) {
        setMentionOpen(true);
        setMentionFilter(query.toLowerCase());
        setMentionIdx(0);
        return;
      }
    }
    setMentionOpen(false);
  }

  function filteredMembers(): MemberInfo[] {
    if (!mentionFilter) return members;
    return members.filter(
      (m) =>
        m.email.toLowerCase().includes(mentionFilter) ||
        (m.name && m.name.toLowerCase().includes(mentionFilter))
    );
  }

  function insertMention(member: MemberInfo) {
    const cursorPos = inputRef.current?.selectionStart ?? body.length;
    const textBeforeCursor = body.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    const before = body.slice(0, atIdx);
    const after = body.slice(cursorPos);
    const newBody = `${before}@${member.email} ${after}`;
    setBody(newBody);
    setMentionOpen(false);
    // Refocus input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = atIdx + member.email.length + 2; // @email + space
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (mentionOpen) {
      const filtered = filteredMembers();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (filtered.length > 0) {
          e.preventDefault();
          insertMention(filtered[mentionIdx]);
        }
      } else if (e.key === "Escape") {
        setMentionOpen(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch("/api/v1/comments", {
        method: "POST",
        body: JSON.stringify({ target_type: targetType, target_id: targetId, body: body.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setBody("");
        setMentionOpen(false);
      }
    } catch { /* ignore */ }
    setSending(false);
  }

  async function handleEdit(id: string) {
    if (!editBody.trim()) return;
    const res = await apiFetch(`/api/v1/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: editBody.trim() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    const res = await apiFetch(`/api/v1/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }

  const mentionList = filteredMembers();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 300 }}>
      {/* Comment list */}
      <div
        ref={listRef}
        style={{
          flex: 1, overflowY: "auto", padding: "16px 16px 8px",
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        {comments.length === 0 && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "var(--n500, #626F86)", fontSize: 13,
          }}>
            <MessageSquare size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            <p style={{ margin: 0 }}>No comments yet. Start the discussion!</p>
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "var(--b100, #E9F2FF)", color: "var(--b700, #0055CC)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
            }}>
              {initials(c.user_email, c.user_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--n900, #091E42)" }}>
                  {c.user_name || c.user_email.split("@")[0]}
                </span>
                <span style={{ fontSize: 11, color: "var(--n400, #8590A2)" }}>
                  {timeAgo(c.created_at)}
                  {c.edited_at && " (edited)"}
                </span>
              </div>
              {editingId === c.id ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEdit(c.id)}
                    style={{
                      flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 4,
                      border: "1px solid var(--n200, #DCDFE4)", outline: "none",
                    }}
                    autoFocus
                  />
                  <button onClick={() => handleEdit(c.id)} style={iconBtnStyle}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} style={iconBtnStyle}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--n800, #172B4D)", lineHeight: 1.5, wordBreak: "break-word" }}>
                  {c.body}
                </p>
              )}
              {editingId !== c.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => { setEditingId(c.id); setEditBody(c.body); }}
                    style={{ ...iconBtnStyle, opacity: 0.5 }}
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{ ...iconBtnStyle, opacity: 0.5 }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input with @mention dropdown */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: "relative",
          display: "flex", gap: 8, padding: "12px 16px",
          borderTop: "1px solid var(--n100, #F1F2F4)",
        }}
      >
        {/* @mention autocomplete dropdown */}
        {mentionOpen && mentionList.length > 0 && (
          <div style={{
            position: "absolute", bottom: "100%", left: 16, right: 60,
            background: "#fff", border: "1px solid var(--n200, #DCDFE4)",
            borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            maxHeight: 180, overflowY: "auto", zIndex: 100,
          }}>
            {mentionList.slice(0, 8).map((m, i) => (
              <button
                key={m.email}
                type="button"
                onClick={() => insertMention(m)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "8px 12px", border: "none", cursor: "pointer", textAlign: "left",
                  background: i === mentionIdx ? "var(--b50, #F7FAFF)" : "transparent",
                  borderBottom: i < mentionList.length - 1 ? "1px solid var(--n50, #F4F5F7)" : "none",
                }}
                onMouseEnter={() => setMentionIdx(i)}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "var(--b100, #E9F2FF)", color: "var(--b700, #0055CC)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700,
                }}>
                  {initials(m.email, m.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--n900, #091E42)" }}>
                    {m.name || m.email.split("@")[0]}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--n400, #8590A2)" }}>
                    {m.email}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "var(--n300, #B3BAC5)", textTransform: "capitalize" }}>
                  {m.role}
                </span>
              </button>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
          placeholder="Write a comment... (type @ to mention)"
          style={{
            flex: 1, fontSize: 13, padding: "8px 12px", borderRadius: 6,
            border: "1px solid var(--n200, #DCDFE4)", outline: "none",
            background: "var(--n25, #F8F9FB)",
          }}
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: 6, border: "none", cursor: "pointer",
            background: body.trim() ? "var(--b600, #0C66E4)" : "var(--n100, #F1F2F4)",
            color: body.trim() ? "#fff" : "var(--n400, #8590A2)",
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 2,
  color: "var(--n500, #626F86)", display: "flex", alignItems: "center",
};
