"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DemoButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error ?? "Could not start the demo. Try again.");
      router.push(`/h/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        className={`rounded-xl bg-brand px-5 py-3 font-medium text-brand-ink shadow-sm transition hover:opacity-90 disabled:opacity-60 ${className}`}
      >
        {busy ? "Setting up 4 friends…" : "Try the 30-second demo"}
      </button>
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </div>
  );
}
