"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DatabaseActions() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected if needed
    e.target.value = "";

    const confirmed = window.confirm(
      `Restore database from "${file.name}"?\n\nThis will REPLACE the current database. This cannot be undone.`
    );
    if (!confirmed) return;

    setRestoring(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/restore", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Restore failed");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-200">
          {error}
        </span>
      )}
      {success && (
        <span className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200">
          Database restored
        </span>
      )}

      {/* Backup */}
      <a
        href="/api/admin/backup"
        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Download backup
      </a>

      {/* Restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".db,application/octet-stream"
        className="hidden"
        onChange={handleRestore}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={restoring}
        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        {restoring ? "Restoring…" : "Restore backup"}
      </button>
    </div>
  );
}
