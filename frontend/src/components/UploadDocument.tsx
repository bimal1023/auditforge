"use client";

import { useRef, useState } from "react";
import { authHeaders } from "@/lib/auth";

interface UploadedDoc {
  id: string;
  filename: string;
  chunks_ingested: number;
  file_type: string;
}

export function UploadDocument() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/documents", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Upload failed");
        return;
      }
      setDocs((prev) => [data, ...prev]);
    } catch {
      setError("Upload failed — network error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Upload Documents</h3>
      <p className="mb-3 text-xs text-slate-400">
        PDF or CSV files are chunked and added to the RAG store for agents to reference.
      </p>

      <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
        {uploading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Uploading…
          </>
        ) : (
          <>
            <span className="text-lg">↑</span>
            Choose PDF or CSV
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv"
          onChange={handleFile}
          className="hidden"
        />
      </label>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {docs.length > 0 && (
        <ul className="mt-3 space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-medium text-slate-700">{d.filename}</span>
              <span className="text-slate-400">{d.chunks_ingested} chunks · {d.file_type.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
