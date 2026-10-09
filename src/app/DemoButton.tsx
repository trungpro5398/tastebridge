"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DemoButton({
  className = "",
  scenario = "friends",
  label = "Try the 30-second demo",
  variant = "primary",
}: {
  className?: string;
  scenario?: "friends" | "family";
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/demo", { method: "POST", body: JSON.stringify({ scenario }) });
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
        className={`rounded-xl px-5 py-3 font-semibold transition hover:opacity-90 disabled:opacity-60 ${
          variant === "primary" ? "bg-brand text-brand-ink" : "border border-line bg-card text-foreground"
        } ${className}`}
      >
        {busy ? "Setting up the group…" : label}
      </button>
      {error && <p className="mt-2 rounded-xl bg-accent/20 px-3 py-2 text-sm">{error}</p>}
    </div>
  );
}
