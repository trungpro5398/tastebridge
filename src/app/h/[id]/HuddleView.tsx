"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import FavouritePicker, { typeLabel } from "@/components/FavouritePicker";
import Results from "@/components/Results";
import type { Decision, Entity, Huddle } from "@/lib/types";

const KIND_LABEL = { place: "Dinner spot", movie: "Movie", tv_show: "TV show" } as const;
type Step = { tool: string; summary: string };
const STEP_LABEL: Record<string, string> = {
  agent: "Agent",
  find_tags: "Matching must-haves to Qloo tags",
  group_candidates: "Building a shortlist from everyone's taste",
  score_for_members: "Scoring the shortlist for each person",
  compare_tastes: "Comparing tastes",
  finalize: "Writing each person's explanation",
};

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
  const [steps, setSteps] = useState<Step[]>([]);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
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

  async function join() {
    setJoining(true);
    setError("");
    const res = await fetch(`/api/huddles/${huddle.id}/members`, {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), picks }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setJoining(false);
    if (!res?.ok || !data.id) return setError(data.error ?? "Could not join. Please try again.");
    try {
      localStorage.setItem(storageKey, data.id);
    } catch {}
    setJustJoined(data.id);
    setPicks([]);
    refresh();
  }

  async function decide(force = false) {
    setSteps([]);
    setVoted(null);
    setDeciding(true);
    setError("");
    try {
      const res = await fetch(`/api/huddles/${huddle.id}/decide`, {
        method: "POST",
        headers: { accept: "application/x-ndjson" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "step") setSteps((prev) => [...prev, { tool: ev.tool, summary: ev.summary }]);
          else if (ev.type === "error") throw new Error(ev.error);
          else if (ev.type === "result") {
            finished = true;
            setHuddle((h) => ({ ...h, result: ev.decision as Decision }));
          }
        }
      }
      if (!finished) throw new Error("The decision was interrupted. Please try again.");
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect. Try again.");
    } finally {
      setDeciding(false);
    }
  }

  async function vote(v: "up" | "down") {
    setVoted(v);
    await fetch(`/api/huddles/${huddle.id}/feedback`, { method: "POST", body: JSON.stringify({ vote: v }) }).catch(() => {});
  }

  async function shareResult() {
    const top = huddle.result?.picks[0];
    if (!top) return;
    const text = `Tonight: ${top.headline}. See why it works for all of us:`;
    const url = window.location.href;
    if (navigator.share) return navigator.share({ title: huddle.title, text, url }).catch(() => {});
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Copy the address from your browser instead.");
    }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: huddle.title, text: "Add your favourites so we can decide:", url }).catch(() => {});
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Could not copy the link. Copy the address from your browser to invite friends.");
      }
    }
  }

  const canDecide = huddle.members.length >= 2;

  const decisionSection = (
    <>
      {deciding ? (
        <div className="rounded-2xl border border-line bg-card p-5" role="status" aria-live="polite">
          <p className="text-sm font-medium">Finding your fair pick…</p>
          <ol className="mt-3 space-y-2.5">
            {steps.map((st, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-xs text-accent">
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{STEP_LABEL[st.tool] ?? st.tool}</span>
                  <span className="block break-words text-xs text-muted">{st.summary}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2.5 text-sm text-muted">
              <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" />
              {steps.length === 0 ? "Reading everyone's favourites" : "Working"}
            </li>
          </ol>
        </div>
      ) : !huddle.result ? (
        <button
          onClick={() => decide()}
          disabled={!canDecide}
          className="w-full rounded-2xl bg-brand px-4 py-4 text-lg font-medium text-brand-ink shadow-sm transition hover:opacity-90 disabled:opacity-40"
        >
          {canDecide ? "Find our fair pick" : "Waiting for at least 2 people"}
        </button>
      ) : null}

      {huddle.result && !deciding && (
        <div ref={resultRef} className="scroll-mt-4 space-y-4">
          <Results decision={huddle.result} />
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              {voted ? (
                <span className="text-muted">Thanks! That helps us improve.</span>
              ) : (
                <>
                  <span>Did this work for your group?</span>
                  <button onClick={() => vote("up")} aria-label="Yes" className="rounded-lg border border-line px-2.5 py-1 hover:bg-soft">
                    👍
                  </button>
                  <button onClick={() => vote("down")} aria-label="No" className="rounded-lg border border-line px-2.5 py-1 hover:bg-soft">
                    👎
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={shareResult} className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background">
                {copied ? "Copied ✓" : "Send to the group"}
              </button>
              <button onClick={() => decide(true)} className="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft">
                Run again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const membersSection = (
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

      {!joinedAs && huddle.members.length < 8 && huddle.result && !showJoin && (
        <button
          onClick={() => setShowJoin(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-line px-4 py-2.5 text-sm hover:bg-soft"
        >
          Add your taste too (the pick will update)
        </button>
      )}
      {!joinedAs && huddle.members.length < 8 && (!huddle.result || showJoin) && (
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm font-medium">Add your taste</p>
          <input
            aria-label="Your first name"
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
  );

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

      {huddle.result || deciding ? decisionSection : membersSection}
      {error && <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand">{error}</p>}
      {huddle.result || deciding ? membersSection : decisionSection}
    </div>
  );
}
