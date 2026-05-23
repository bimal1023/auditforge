"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, MoreHorizontal, ChevronRight } from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/auth";
import { Pill, ScoreChip } from "./ui";
import type { Report } from "@/lib/types";

interface UploadedDoc {
  id: string;
  filename: string;
  chunks_ingested: number;
  file_type: string;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

export function UploadDocument() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  useEffect(() => {
    apiFetch("/api/v1/reports")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Report[]) => setRecentReports(data.slice(0, 6)))
      .catch(() => {});
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/v1/documents", {
        method: "POST", headers: authHeaders(), body: formData,
      });
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

  const allDocs = [
    ...docs,
    ...(docs.length === 0 ? [
      { id: "d1", filename: "Apple_10K_2023.pdf",       chunks_ingested: 248, file_type: "pdf" },
      { id: "d2", filename: "Apple_Q3_earnings.csv",    chunks_ingested: 64,  file_type: "csv" },
      { id: "d3", filename: "Antitrust_DOJ_filing.pdf", chunks_ingested: 187, file_type: "pdf" },
    ] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Knowledge base card */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, boxShadow: "var(--shadow-sm)", padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Knowledge base</span>
          <Pill tone="outline" dot>{allDocs.length} docs</Pill>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
          Upload PDFs and CSVs. Agents cite them alongside SEC filings.
        </p>

        {/* Drop zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            padding: "16px 14px",
            background: dragOver ? "var(--brand-soft)" : "var(--brand-tint)",
            border: `1.5px dashed ${dragOver ? "var(--brand-hover)" : "var(--brand)"}`,
            borderRadius: 10, cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
            transition: "all 0.15s",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--brand-soft)", color: "var(--brand)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            {uploading
              ? <span style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid var(--brand-soft)", borderTopColor: "var(--brand)", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
              : <Upload size={14} />
            }
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
            {uploading ? "Uploading…" : "Drag PDF or CSV here"}
          </div>
          {!uploading && (
            <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
              or <span style={{ color: "var(--brand)", fontWeight: 500 }}>browse files</span>
            </div>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.csv" onChange={handleFile} className="hidden" />
        </label>

        {error && <p style={{ marginTop: 8, fontSize: 11.5, color: "var(--red-ink)" }}>{error}</p>}

        {/* Doc list */}
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {allDocs.map((d) => (
            <div key={d.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 8,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 5, flexShrink: 0,
                background: d.file_type === "pdf" ? "var(--red-soft)" : "var(--green-soft)",
                color: d.file_type === "pdf" ? "var(--red-ink)" : "var(--green-ink)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 8.5, fontWeight: 700, letterSpacing: "0.04em",
              }}>
                {d.file_type.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.filename}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-4)" }}>
                  {d.chunks_ingested} chunks
                </div>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 2, display: "flex" }}>
                <MoreHorizontal size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent reports */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, boxShadow: "var(--shadow-sm)", padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Recent reports</span>
          <a style={{ fontSize: 11.5, color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}>View all</a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {recentReports.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-4)", padding: "6px 10px" }}>
              No reports yet.
            </p>
          ) : recentReports.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {r.overall_score != null
                ? <ScoreChip score={r.overall_score} size="sm" />
                : <div style={{
                    width: 44, height: 22, borderRadius: 999,
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600, color: "var(--ink-4)",
                  }}>{r.status === "error" ? "ERR" : "…"}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company}</div>
                <div style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "JetBrains Mono, monospace" }}>
                  {r.ticker ?? "–"} · {r.generated_at ? relativeTime(r.generated_at) : r.status}
                </div>
              </div>
              <ChevronRight size={12} color="var(--ink-4)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
