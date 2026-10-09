"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import FavouritePicker, { typeLabel } from "@/components/FavouritePicker";
import InvitePanel from "@/components/InvitePanel";
import Avatar from "@/components/Avatar";
import Results from "@/components/Results";
import { memberColor } from "@/lib/members";
import type { Decision, Entity, Huddle } from "@/lib/types";

const KIND_LABEL = { place: "Dinner spot", movie: "Movie", tv_show: "TV show" } as const;
type Step = { tool: string; summary: string };
const STEP_LABEL: Record<string, string> = {
  agent: "Planning",
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
  const [showInvite, setShowInvite] = useState(false);
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

  // Deep links (#evidence, #how) open the matching panel, e.g. for judges.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const open = new URLSearchParams(window.location.search).get("open")?.split(",") ?? [];
    for (const id of [hash, ...open]) {
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
    }
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, []);

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
      // Send only what the decision needs (the search result carries more).
      body: JSON.stringify({
        name: name.trim(),
        picks: picks.map(({ entity_id, name, type, image, meta, tags }) => ({
          entity_id,
          name,
          type,
          image,
          meta,
          tags: tags?.slice(0, 12),
        })),
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setJoining(false);
    if (!res?.ok || !data.id) return setError(data.error ?? "Could not join. Please try again.");
    try {
      localStorage.setItem(storageKey, data.id);
    } catch {}
    setJustJoined(data.id);
    setPicks([]);
    // First one in: the next step is getting friends here.
    if (huddle.members.length < 2) setShowInvite(true);
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
        if (res.status === 409 && data.deciding) {
          setHuddle((h) => ({ ...h, deciding: true }));
          return;
        }
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

  /** Take your entry back out so you can change your favourites, keeping what you had. */
  async function editMine() {
    const me = huddle.members.find((m) => m.id === joinedAs);
    if (!me) return;
    setError("");
    const res = await fetch(`/api/huddles/${huddle.id}/members/${me.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || (!res.ok && res.status !== 404)) return setError("Could not edit right now. Try again.");
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setJustJoined(null);
    setName(me.name);
    setPicks(me.picks);
    setShowJoin(true);
    setHuddle((h) => ({ ...h, members: h.members.filter((m) => m.id !== me.id), result: null }));
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

  const canDecide = huddle.members.length >= 2;
  const colors = Object.fromEntries(huddle.members.map((m, i) => [m.id, memberColor(i)]));
  const stage = huddle.result ? 3 : canDecide ? 2 : 1;

  const decisionSection = (
    <>
      {deciding ? (
        <div className="rounded-3xl border border-line bg-card p-5 sm:p-6" role="status" aria-live="polite">
          <p className="font-display text-lg font-semibold">Finding your fair pick</p>
          <p className="text-sm text-muted">The agent is asking Qloo about everyone&apos;s taste. About 20 seconds.</p>
          <ol className="mt-4 space-y-3">
            {steps.map((st, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-ink">
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{STEP_LABEL[st.tool] ?? st.tool}</span>
                  <span className="block break-words text-muted">{st.summary}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center gap-3 text-sm text-muted">
              <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" />
              {steps.length === 0 ? "Reading everyone's favourites" : "Working on the next step"}
            </li>
          </ol>
        </div>
      ) : !huddle.result && huddle.deciding ? (
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-card p-5 text-sm" role="status">
          <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" />
          Someone in your group is finding the pick. This page updates by itself.
        </div>
      ) : !huddle.result && canDecide ? (
        <div className="rounded-3xl bg-brand p-5 text-brand-ink sm:p-6">
          <p className="font-display text-xl font-semibold">
            {huddle.members.length} people are in. Ready when you are.
          </p>
          <p className="mt-1 text-sm opacity-80">Friends can still join later; the pick updates when they do.</p>
          <button
            onClick={() => decide()}
            className="mt-4 w-full rounded-2xl bg-card px-4 py-3.5 font-display text-lg font-semibold text-brand hover:opacity-95 sm:w-auto sm:px-8"
          >
            Find our fair pick
          </button>
        </div>
      ) : !huddle.result && huddle.members.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-dashed border-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            You need at least 2 people for a group pick. Invite someone to add their favourites.
          </p>
          <button
            onClick={() => setShowInvite(true)}
            className="shrink-0 rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-soft"
          >
            Invite friends
          </button>
        </div>
      ) : null}

      {huddle.result && !deciding && (
        <div ref={resultRef} className="scroll-mt-4 space-y-4">
          <Results decision={huddle.result} colors={colors} />
          <div className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {voted ? (
                <span className="text-muted">Thanks, noted.</span>
              ) : (
                <>
                  <span className="mr-1">Did this work for your group?</span>
                  <button onClick={() => vote("up")} className="rounded-lg border border-line px-3 py-1.5 hover:bg-soft">
                    Yes
                  </button>
                  <button onClick={() => vote("down")} className="rounded-lg border border-line px-3 py-1.5 hover:bg-soft">
                    Not really
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={shareResult} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
                {copied ? "Link copied" : "Share the pick"}
              </button>
              <button onClick={() => decide(true)} className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-soft">
                Run again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const membersSection = (
    <section className="rounded-3xl border border-line bg-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Who&apos;s in</h2>
        <span className="text-sm text-muted">{huddle.members.length} of 8</span>
      </div>
      {huddle.members.length === 0 && (
        <p className="mt-2 text-sm text-muted">Nobody yet. Add your taste below, then invite your group.</p>
      )}
      <ul className="mt-3 space-y-3">
        {huddle.members.map((m) => (
          <li key={m.id} className="flex gap-3">
            <Avatar name={m.name} color={colors[m.id]} />
            <div className="min-w-0">
              <p className="font-medium">
                {m.name}
                {m.id === joinedAs && (
                  <>
                    <span className="ml-1.5 text-sm font-normal text-muted">(you)</span>
                    <button onClick={editMine} className="ml-2 text-sm font-normal text-brand underline-offset-4 hover:underline">
                      Edit
                    </button>
                  </>
                )}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {m.picks.map((p) => (
                  <li key={p.entity_id} className="max-w-full truncate rounded-full bg-soft px-2.5 py-0.5 text-xs">
                    <span className="text-muted">{typeLabel(p.type)}</span> {p.name}
                  </li>
                ))}
              </ul>
            </div>
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
          <h3 className="font-display font-semibold">Add your taste</h3>
          <p className="text-sm text-muted">Your first name and up to three favourites. No account needed.</p>
          <label className="mt-3 block text-sm font-medium" htmlFor="member-name">
            First name
          </label>
          <input
            id="member-name"
            aria-label="Your first name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mai"
            maxLength={40}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-brand"
          />
          <p className="mt-3 text-sm font-medium">Favourites</p>
          <div className="mt-1">
            <FavouritePicker value={picks} onChange={setPicks} />
          </div>
          <button
            onClick={join}
            disabled={joining || !name.trim() || picks.length === 0}
            className="mt-4 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {joining ? "Adding…" : picks.length ? `Join with ${picks.length} favourite${picks.length > 1 ? "s" : ""}` : "Join"}
          </button>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6 pt-6">
      <section>
        <p className="text-sm text-muted">
          {KIND_LABEL[huddle.kind]}
          {huddle.location && huddle.kind === "place" ? ` in ${huddle.location}` : ""}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">{huddle.title}</h1>
          <button
            onClick={() => setShowInvite((v) => !v)}
            aria-expanded={showInvite}
            className="mt-1 shrink-0 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium hover:bg-soft"
          >
            Invite friends
          </button>
        </div>
        {huddle.notes && (
          <p className="mt-1 text-muted">
            Must-haves: <span className="text-foreground">{huddle.notes}</span>
          </p>
        )}
        <ol className="mt-5 grid grid-cols-3 gap-2 text-xs sm:text-sm" aria-label="Progress">
          {["Add tastes", "Find the pick", "Go"].map((label, i) => {
            const n = i + 1;
            const done = stage > n;
            const current = stage === n;
            return (
              <li key={label} aria-current={current ? "step" : undefined}>
                <div className={`h-1.5 rounded-full ${done || current ? "bg-brand" : "bg-line"}`} />
                <p className={`mt-1.5 ${current ? "font-semibold" : "text-muted"}`}>
                  {label}
                  {n === 1 && huddle.members.length > 0 ? ` (${huddle.members.length})` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {showInvite && <InvitePanel title={huddle.title} onClose={() => setShowInvite(false)} />}

      {huddle.result || deciding ? decisionSection : membersSection}
      {error && <p className="rounded-2xl bg-accent/20 px-4 py-3 text-sm">{error}</p>}
      {huddle.result || deciding ? membersSection : decisionSection}
    </div>
  );
}
