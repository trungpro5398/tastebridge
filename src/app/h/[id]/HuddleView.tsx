"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import FavouritePicker, { typeLabel } from "@/components/FavouritePicker";
import Results from "@/components/Results";
import type { Decision, Entity, Huddle } from "@/lib/types";

const KIND_LABEL = { place: "Dinner spot", movie: "Movie", tv_show: "TV show" } as const;
const THINKING = [
  "Reading everyone's favourites…",
  "Asking Qloo what this group might love…",
  "Scoring each option for each person…",
  "Checking nobody gets left out…",
  "Writing up the why…",
];

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function HuddleView({ initial }: { initial: Huddle }) {
  const [huddle, setHuddle] = useState(initial);
  const [justJoined, setJustJoined] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [picks, setPicks] = useState<Entity[]>([]);
  const [joining, setJoining] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const storageKey = `tb:${initial.id}`;

  const stored = useSyncExternalStore(subscribeStorage, () => readStorage(storageKey), () => null);
  const joinedAs = justJoined ?? stored;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/huddles/${initial.id}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setHuddle(await res.json());
  }, [initial.id]);

  // Light-weight live updates: friends joining, results arriving.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && !deciding && refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh, deciding]);

  useEffect(() => {
    if (!deciding) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, THINKING.length - 1)), 3500);
    return () => clearInterval(t);
  }, [deciding]);

  async function join() {
    setJoining(true);
    setError("");
    const res = await fetch(`/api/huddles/${huddle.id}/members`, {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), picks }),
    });
    const data = await res.json();
    setJoining(false);
    if (!res.ok) return setError(data.error ?? "Could not join");
    try {
      localStorage.setItem(storageKey, data.id);
    } catch {}
    setJustJoined(data.id);
    setPicks([]);
    refresh();
  }

  async function decide() {
    setStep(0);
    setDeciding(true);
    setError("");
    const res = await fetch(`/api/huddles/${huddle.id}/decide`, { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setDeciding(false);
    if (!res?.ok) return setError(data.error ?? "Something went wrong. Try again.");
    setHuddle((h) => ({ ...h, result: data as Decision }));
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: huddle.title, text: "Add your favourites so we can decide:", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const canDecide = huddle.members.length >= 2;

  return (
    <div className="space-y-6 pt-6">
      <section>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-soft px-2 py-0.5">{KIND_LABEL[huddle.kind]}</span>
          {huddle.location && huddle.kind === "place" && <span>📍 {huddle.location}</span>}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{huddle.title}</h1>
          <button onClick={share} className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft">
            {copied ? "Link copied ✓" : "Invite friends"}
          </button>
        </div>
        {huddle.notes && <p className="mt-1 text-sm text-muted">Must-haves: {huddle.notes}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-medium">
          Who&apos;s in <span className="text-muted">({huddle.members.length})</span>
        </h2>
        {huddle.members.length === 0 && (
          <p className="mt-2 text-sm text-muted">Nobody yet. Add yourself, then send the link to your group.</p>
        )}
        <ul className="mt-3 space-y-3">
          {huddle.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">
                {m.name}
                {m.id === joinedAs && <span className="ml-1 text-xs text-muted">(you)</span>}
              </span>
              <span className="text-sm text-muted">
                {m.picks.map((p) => `${p.name} (${typeLabel(p.type)})`).join(" · ")}
              </span>
            </li>
          ))}
        </ul>

        {!joinedAs && (
          <div className="mt-5 border-t border-line pt-5">
            <p className="text-sm font-medium">Add your taste</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              maxLength={40}
              className="mt-2 w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-brand"
            />
            <div className="mt-3">
              <FavouritePicker value={picks} onChange={setPicks} />
            </div>
            <button
              onClick={join}
              disabled={joining || !name.trim() || picks.length === 0}
              className="mt-4 w-full rounded-xl bg-foreground px-4 py-3 font-medium text-background disabled:opacity-40"
            >
              {joining ? "Adding…" : "I'm in"}
            </button>
          </div>
        )}
      </section>

      {error && <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand">{error}</p>}

      {deciding ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-center" role="status">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="mt-3 text-sm">{THINKING[step]}</p>
        </div>
      ) : (
        <button
          onClick={decide}
          disabled={!canDecide}
          className="w-full rounded-2xl bg-brand px-4 py-4 text-lg font-medium text-brand-ink shadow-sm transition hover:opacity-90 disabled:opacity-40"
        >
          {huddle.result ? "Decide again" : canDecide ? "Find our fair pick" : "Waiting for at least 2 people"}
        </button>
      )}

      {huddle.result && !deciding && <Results decision={huddle.result} />}
    </div>
  );
}
