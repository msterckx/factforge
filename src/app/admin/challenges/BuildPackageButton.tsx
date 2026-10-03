"use client";

import { useState, useRef } from "react";

interface Props {
  slug?: string;   // omit to build all map packages
  label?: string;
}

type LogLine = { text: string; err?: boolean };

export default function BuildPackageButton({ slug, label }: Props) {
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState<boolean | null>(null);
  const [lines, setLines]       = useState<LogLine[]>([]);
  const [logOpen, setLogOpen]   = useState(false);
  const logRef                  = useRef<HTMLDivElement>(null);

  async function run() {
    setRunning(true);
    setDone(null);
    setLines([]);
    setLogOpen(true);

    let res: Response;
    try {
      res = await fetch("/api/admin/challenges/build-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    } catch {
      setLines([{ text: "Network error — is the dev server running?", err: true }]);
      setDone(false);
      setRunning(false);
      return;
    }

    if (!res.ok || !res.body) {
      setLines([{ text: `Server error ${res.status}`, err: true }]);
      setDone(false);
      setRunning(false);
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done: eof, value } = await reader.read();
      if (eof) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop()!;
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        let msg: { line?: string; err?: boolean; done?: boolean; ok?: boolean };
        try { msg = JSON.parse(part.slice(6)); } catch { continue; }
        if (msg.done) {
          setDone(msg.ok ?? false);
          setRunning(false);
        } else if (msg.line) {
          setLines((prev) => [...prev, { text: msg.line!, err: msg.err }]);
          setTimeout(() => {
            if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
          }, 0);
        }
      }
    }
  }

  const btnLabel = label ?? (slug ? "Build Package" : "Rebuild All Packages");

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? "Building…" : btnLabel}
        </button>

        {done !== null && !running && (
          <span className={`text-sm font-medium ${done ? "text-emerald-600" : "text-red-500"}`}>
            {done ? "✓ Package built" : "✗ Build failed"}
          </span>
        )}

        {lines.length > 0 && (
          <button
            onClick={() => setLogOpen((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            {logOpen ? "Hide log" : "Show log"}
          </button>
        )}
      </div>

      {logOpen && lines.length > 0 && (
        <div
          ref={logRef}
          className="mt-3 bg-slate-900 text-slate-300 rounded-lg p-3 text-xs font-mono max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed"
        >
          {lines.map((l, i) => (
            <div key={i} className={l.err ? "text-red-400" : ""}>
              {l.text}
            </div>
          ))}
          {running && <span className="animate-pulse text-slate-500">▋</span>}
        </div>
      )}
    </div>
  );
}
