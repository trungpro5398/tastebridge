"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const KINDS = [
  { value: "place", label: "Dinner spot", emoji: "🍜" },
  { value: "movie", label: "Movie", emoji: "🎬" },
  { value: "tv_show", label: "TV show", emoji: "📺" },
] as const;

export default function CreateHuddle() {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("place");
  const [busy, setBusy] = useState<"create" | null>(null);
  const [error, setError] = useState("");

  async function submit(form: FormData) {
    setBusy("create");
    setError("");
    const body = {
      title: String(form.get("title") || "Tonight"),
      kind,
      location: kind === "place" ? String(form.get("location") || "") || undefined : undefined,
      notes: String(form.get("notes") || "") || undefined,
    };
    try {
      const res = await fetch("/api/huddles", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error ?? "Could not create a huddle. Try again.");
      router.push(`/h/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <form action={submit} className="space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="title">
            What are we deciding?
          </label>
          <input
            id="title"
            name="title"
            placeholder="Friday night with the crew"
            maxLength={80}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-brand"
          />
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
          {KINDS.map((k) => (
            <button
              type="button"
              key={k.value}
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => setKind(k.value)}
              className={`rounded-xl border px-2 py-2.5 text-sm transition ${
                kind === k.value ? "border-brand bg-brand/10 font-medium" : "border-line hover:bg-soft"
              }`}
            >
              <span className="block text-lg">{k.emoji}</span>
              {k.label}
            </button>
          ))}
        </div>
        {kind === "place" && (
          <div>
            <label className="text-sm font-medium" htmlFor="location">
              Where?
            </label>
            <input
              id="location"
              name="location"
              defaultValue="Melbourne"
              maxLength={80}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-brand"
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium" htmlFor="notes">
            Must-haves <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="notes"
            name="notes"
            placeholder="One vegetarian, under $$$"
            maxLength={300}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-brand"
          />
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <button
          disabled={!!busy}
          className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-brand-ink transition hover:opacity-90 disabled:opacity-60"
        >
          {busy === "create" ? "Creating…" : "Start a huddle"}
        </button>
      </form>
    </div>
  );
}
