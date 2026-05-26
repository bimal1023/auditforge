"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileText, Table2 } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Pill, Spinner } from "./ui";

interface UploadedDoc {
  id: string;
  filename: string;
  chunks_ingested: number;
  file_type: string;
}

function relativeTime(isoDate: string | undefined | null): string {
  if (!isoDate) return "—";
  const diff = Date.now() - new Date(isoDate).getTime();
  if (isNaN(diff)) return "—";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

export function UploadDocument() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs]           = useState<UploadedDoc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  /* ── Load existing documents on mount ── */
  useEffect(() => {
    apiFetch("/api/v1/documents")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res  = await apiFetch("/api/v1/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Upload failed"); return; }
      setDocs((prev) => [data, ...prev]);
    } catch {
      setError("Upload failed — network error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  async function deleteDoc(id: string) {
    if (deleting) return;
    setDeleting(id);
    try {
      const res = await apiFetch(`/api/v1/documents/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Delete failed");
      }
    } catch {
      setError("Delete failed — network error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Knowledge base ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, boxShadow: "var(--shadow-xs)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Knowledge base</span>
          <Pill tone="outline">{loading ? "…" : `${docs.length} docs`}</Pill>
        </div>

        <div style={{ padding: 12 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.55 }}>
            Upload PDFs and CSVs. Agents cite them alongside SEC filings.
          </p>

          {/* Drop zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "14px 12px",
              background: dragOver ? "var(--brand-soft)" : "var(--brand-tint)",
              border: `1.5px dashed ${dragOver ? "var(--brand)" : "rgba(27,58,107,0.30)"}`,
              borderRadius: 10, cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.7 : 1,
              transition: "all 0.15s",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: dragOver ? "var(--brand)" : "var(--brand-soft)",
              color: dragOver ? "#fff" : "var(--brand)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {uploading ? <Spinner size={14} color="var(--brand)" /> : <Upload size={14} />}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand)" }}>
              {uploading ? "Uploading…" : "Drag PDF or CSV here"}
            </div>
            {!uploading && (
              <div style={{ fontSize: 11, color: "var(--brand-ink)", opacity: 0.7 }}>
                or <span style={{ fontWeight: 600 }}>browse files</span>
              </div>
            )}
            <input ref={inputRef} type="file" accept=".pdf,.csv" onChange={handleFile} className="hidden" />
          </label>

          {error && (
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--red-ink)", fontWeight: 500 }}>{error}</p>
          )}

          {/* Doc list */}
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
                <Spinner size={16} color="var(--brand)" />
              </div>
            )}
            {!loading && docs.length === 0 && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--ink-4)", textAlign: "center", padding: "10px 0" }}>
                No documents yet — upload one above.
              </p>
            )}
            {docs.map((d) => {
              const isPdf = d.file_type === "pdf";
              return (
                <div key={d.id} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px",
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: 9,
                  transition: "background 0.12s",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: isPdf ? "var(--red-soft)" : "var(--green-soft)",
                    color: isPdf ? "var(--red-ink)" : "var(--green-ink)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isPdf ? <FileText size={13} /> : <Table2 size={13} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.filename}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>
                      {d.chunks_ingested} chunks · {d.file_type.toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDoc(d.id)}
                    disabled={!!deleting}
                    title="Remove document"
                    style={{
                      background: "none", border: "none", cursor: deleting ? "not-allowed" : "pointer",
                      color: deleting === d.id ? "var(--red-ink)" : "var(--ink-4)",
                      padding: 4, display: "flex", borderRadius: 5,
                      opacity: deleting && deleting !== d.id ? 0.4 : 1,
                      transition: "color 0.12s, background 0.12s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { if (!deleting) { e.currentTarget.style.color = "var(--red-ink)"; e.currentTarget.style.background = "var(--red-soft)"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-4)"; e.currentTarget.style.background = "none"; }}
                  >
                    {deleting === d.id
                      ? <Spinner size={13} color="var(--red-ink)" />
                      : <Trash2 size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
