"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileText, Table2, FileType2, Presentation, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "./ui";

/** Icon + color treatment per file type for the document list. */
function fileVisual(type: string): { icon: typeof FileText; bg: string; fg: string } {
  switch (type) {
    case "pdf":
      return { icon: FileText, bg: "var(--r50)", fg: "var(--r500)" };
    case "csv":
    case "xlsx":
      return { icon: Table2, bg: "var(--g50)", fg: "var(--g500)" };
    case "pptx":
      return { icon: Presentation, bg: "var(--y50)", fg: "var(--y700)" };
    case "docx":
    case "txt":
    default:
      return { icon: FileType2, bg: "var(--b50)", fg: "var(--b500)" };
  }
}

interface UploadedDoc {
  id: string;
  filename: string;
  chunks_ingested: number;
  file_type: string;
}

export function UploadDocument() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs]           = useState<UploadedDoc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [toast, setToast]         = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [uploadStep, setUploadStep] = useState<string>("");

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }

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
    setUploadStep("Uploading file...");

    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploadStep("Parsing document...");
      const res  = await apiFetch("/api/v1/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Upload failed");
        showToast("error", data.detail ?? "Upload failed");
        return;
      }
      setDocs((prev) => [data, ...prev]);
      showToast("success", `"${data.filename}" uploaded — ${data.chunks_ingested} chunks indexed`);
    } catch {
      setError("Upload failed — network error");
      showToast("error", "Upload failed — network error");
    } finally {
      setUploading(false);
      setUploadStep("");
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
        showToast("error", data.detail ?? "Delete failed");
      }
    } catch {
      showToast("error", "Delete failed — network error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-100)" }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "var(--s-150)",
          padding: "var(--s-150) var(--s-200)",
          background: toast.type === "success" ? "var(--g50)" : "var(--r50)",
          border: `1px solid ${toast.type === "success" ? "var(--g100)" : "var(--r100)"}`,
          borderLeft: `3px solid ${toast.type === "success" ? "var(--g500)" : "var(--r500)"}`,
          borderRadius: "var(--r-2)",
        }}>
          <div style={{
            flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
            background: toast.type === "success" ? "var(--g500)" : "var(--r500)",
            color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginTop: 1,
          }}>
            {toast.type === "success" ? <Check size={10} /> : <X size={10} />}
          </div>
          <span style={{ flex: 1, fontSize: 13, color: "var(--n800)", lineHeight: 1.5 }}>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: "var(--n200)", flexShrink: 0, marginTop: 1,
          }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Upload card ── */}
      <div style={{
        background: "var(--n0)", border: "1px solid var(--n30)",
        borderRadius: "var(--r-3)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "var(--s-150) var(--s-200)",
          borderBottom: "1px solid var(--n30)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n900)", letterSpacing: "-0.01em" }}>Documents</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, color: "var(--n200)",
            background: "var(--n20)", padding: "2px 8px", borderRadius: "var(--r-1)",
          }}>{loading ? "..." : `${docs.length} files`}</span>
        </div>

        <div style={{ padding: "var(--s-150)" }}>
          <p style={{ margin: "0 0 var(--s-100)", fontSize: 12, color: "var(--n300)", lineHeight: 1.55 }}>
            Upload PDF, Word, Excel, PowerPoint, CSV, or text files. Agents cite them alongside SEC filings.
          </p>

          {/* Drop zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--s-75)",
              padding: "var(--s-200) var(--s-150)",
              background: dragOver ? "var(--b50)" : "var(--n10)",
              border: `1.5px dashed ${dragOver ? "var(--b400)" : "var(--n30)"}`,
              borderRadius: "var(--r-2)", cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.7 : 1, transition: "all 0.15s",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "var(--r-2)",
              background: dragOver ? "var(--b500)" : "var(--b50)",
              color: dragOver ? "#fff" : "var(--b500)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {uploading ? <Spinner size={14} color="var(--b500)" /> : <Upload size={15} />}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--b500)" }}>
              {uploading ? uploadStep : "Drag a file here"}
            </div>
            {!uploading && (
              <div style={{ fontSize: 11, color: "var(--n200)" }}>
                or <span style={{ fontWeight: 600 }}>browse files</span>
              </div>
            )}
            <input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.docx,.pptx,.txt" onChange={handleFile} style={{ display: "none" }} />
          </label>

          {error && !toast && (
            <p style={{ margin: "var(--s-100) 0 0", fontSize: 12, color: "var(--r500)", fontWeight: 500 }}>{error}</p>
          )}

          {/* Doc list */}
          <div style={{ marginTop: "var(--s-150)", display: "flex", flexDirection: "column", gap: "var(--s-50)" }}>
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "var(--s-150) 0" }}>
                <Spinner size={16} color="var(--b500)" />
              </div>
            )}
            {!loading && docs.length === 0 && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--n200)", textAlign: "center", padding: "var(--s-100) 0" }}>
                No documents yet — upload one above.
              </p>
            )}
            {docs.map((d) => {
              const visual = fileVisual(d.file_type);
              const Icon = visual.icon;
              return (
                <div key={d.id} style={{
                  display: "flex", alignItems: "center", gap: "var(--s-100)",
                  padding: "var(--s-100) var(--s-150)",
                  background: "var(--n10)", border: "1px solid var(--n20)",
                  borderRadius: "var(--r-2)", transition: "background 0.12s",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "var(--r-2)", flexShrink: 0,
                    background: visual.bg,
                    color: visual.fg,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--n800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.filename}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--n200)", marginTop: 1 }}>
                      {d.chunks_ingested} chunks · {d.file_type.toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDoc(d.id)}
                    disabled={!!deleting}
                    title="Remove document"
                    style={{
                      background: "none", border: "none",
                      cursor: deleting ? "not-allowed" : "pointer",
                      color: "var(--n200)", padding: 4, display: "flex",
                      borderRadius: "var(--r-1)", flexShrink: 0,
                      opacity: deleting && deleting !== d.id ? 0.4 : 1,
                      transition: "color 0.12s, background 0.12s",
                    }}
                  >
                    {deleting === d.id
                      ? <Spinner size={13} color="var(--r500)" />
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
