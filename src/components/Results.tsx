import type React from "react";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import FairnessChart from "@/components/FairnessChart";
import TasteMap from "@/components/TasteMap";
import ShortlistMap from "@/components/ShortlistMap";
import { highlights } from "@/lib/highlights";
import { STEP_LABEL } from "@/lib/steps";
import { useTimeZone, watchRegion } from "@/lib/locale";
import type { Decision, MemberScore, RankedCandidate } from "@/lib/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

type Colors = Record<string, string>;

/** "Archie's All Day – welcoming Fitzroy brunch" → hook "Welcoming Fitzroy brunch". */
function hookOf(headline: string, name: string) {
  const rest = headline.startsWith(name) ? headline.slice(name.length).replace(/^\s*[–—:-]\s*/, "") : "";
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
}

const metaText = (meta?: string) => meta?.split(" · ").join(", ");

/** The person the fair pick protects: the lowest match among people who actually have a preference tonight. */
function lowest(scores: MemberScore[]) {
  return scores.filter((s) => !s.flexible).sort((a, b) => a.satisfaction - b.satisfaction)[0];
}

/** "Brought by Linh" / "Brought by Mai and Leo": whose own taste put this option on the table. */
function broughtBy(names?: string[]) {
  if (!names?.length) return "";
  if (names.length === 1) return `Brought by ${names[0]}`;
  return `Brought by ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** "12th of 24 options": the honest reading of a within-shortlist percentile. */
function rankText(percentile: number, n: number) {
  const r = Math.round((1 - percentile) * (n - 1)) + 1;
  const suffix = r % 10 === 1 && r % 100 !== 11 ? "st" : r % 10 === 2 && r % 100 !== 12 ? "nd" : r % 10 === 3 && r % 100 !== 13 ? "rd" : "th";
  return `${r}${suffix} of ${n}`;
}

/** Secondary views, rendered only when opened (the map needs a visible container). */
function MoreDetail({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="border-t border-line pt-5"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer font-display text-base font-semibold">
        More: every option on a chart and a map, and how alike your tastes are
      </summary>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </details>
  );
}

function KnownFor({ c, n = 4 }: { c: RankedCandidate; n?: number }) {
  const tags = highlights(c.entity, n);
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Known for">
      {tags.map((t) => (
        <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
          {t}
        </li>
      ))}
    </ul>
  );
}

/** The obvious next action once the group has a pick. */
function NextStep({ c }: { c: RankedCandidate }) {
  const tz = useTimeZone();
  const q = encodeURIComponent([c.entity.name, c.entity.address ?? c.entity.meta?.split(" · ")[0]].filter(Boolean).join(" "));
  const isPlace = c.entity.type === "urn:entity:place";
  const href = isPlace
    ? `https://www.google.com/maps/search/?api=1&query=${q}`
    : `https://www.justwatch.com/${tz ? watchRegion(tz) : "au"}/search?q=${encodeURIComponent(c.entity.name)}`;
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink hover:opacity-90"
      >
        {isPlace ? "Open in Maps" : "Find where to watch"}
      </a>
      {c.entity.website && (
        <a
          href={c.entity.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-soft"
        >
          Website
        </a>
      )}
    </div>
  );
}

/** Words alongside the number, so nobody has to interpret a percentile. */
export function fitWord(x: number) {
  if (x >= 0.8) return "great fit";
  if (x >= 0.6) return "good fit";
  if (x >= 0.4) return "okay";
  return "a stretch";
}

/** One person's row in the fairness meter. */
function MeterRow({
  s,
  color,
  reason,
  protectedRow,
  ownTop,
  rank,
}: {
  s: MemberScore;
  color: string;
  reason?: string;
  protectedRow?: boolean;
  /** this person's own top option tonight, when it isn't the pick */
  ownTop?: string;
  /** "9th of 21": where the pick sits on this person's own list */
  rank?: string;
}) {
  const v = Math.round(s.satisfaction * 100);
  return (
    <li className={`rounded-2xl px-3 py-2.5 ${protectedRow ? "bg-accent/15" : ""}`}>
      <div className="flex items-center gap-3">
        <Avatar name={s.member_name} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium">
              <span className="truncate">{s.member_name}</span>
              {protectedRow && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                  lowest match, protected
                </span>
              )}
              {s.flexible && (
                <span
                  title="Based on tonight's options: Qloo sees only small differences between them for this person, so the fair pick focuses on people with clearer preferences. With a different list they may not be flexible."
                  className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted"
                >
                  flexible tonight
                </span>
              )}
            </span>
            <span className="shrink-0 text-right">
              <span className="font-display text-lg font-semibold tabular-nums">{rank ?? `${v}%`}</span>
              <span className="ml-1.5 text-xs text-muted">
                {rank ? `${v}% match, ` : ""}
                {s.flexible ? "flexible" : fitWord(s.satisfaction)}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-soft" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${Math.max(v, 3)}%`, background: color }} />
          </div>
        </div>
      </div>
      {reason && <p className="mt-1.5 pl-11 text-sm text-muted">{reason}</p>}
      {ownTop && <p className="mt-1 pl-11 text-xs text-muted">Your own #1 of tonight&apos;s options: {ownTop}</p>}
    </li>
  );
}

function compatLabel(score: number) {
  if (score >= 0.7) return "Close tastes";
  if (score >= 0.55) return "Some common ground";
  if (score >= 0.45) return "A real mix";
  return "Pulling in different directions";
}

function Pair({
  p,
  label,
  colorOfName,
}: {
  p?: { a: string; b: string; r: number };
  label: string;
  colorOfName: (name: string) => string;
}) {
  if (!p) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex -space-x-1.5">
        <Avatar name={p.a} color={colorOfName(p.a)} size="sm" />
        <Avatar name={p.b} color={colorOfName(p.b)} size="sm" />
      </span>
      <span>
        <span className="text-muted">{label}: </span>
        {p.a} &amp; {p.b}
      </span>
    </div>
  );
}

/** How alike the group's tastes are on tonight's shortlist, and who agrees or clashes most. */
function Compatibility({
  c,
  colorOfName,
}: {
  c: NonNullable<Decision["compatibility"]>;
  colorOfName: (name: string) => string;
}) {
  const v = Math.round(c.score * 100);
  return (
    <div className="rounded-3xl border border-line bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">Your group&apos;s taste compatibility</h3>
        <p className="font-display text-xl font-semibold">{compatLabel(c.score)}</p>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-soft" aria-hidden>
        <div className="h-full rounded-full bg-brand" style={{ width: `${v}%` }} />
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-muted" />
      </div>
      <p className="mt-1 flex justify-between text-xs text-muted" aria-hidden>
        <span>opposite tastes</span>
        <span>unrelated</span>
        <span>same tastes</span>
      </p>
      <p className="mt-2 text-sm text-muted">
        How similarly you rank tonight&apos;s options.{" "}
        {c.score < 0.5
          ? "With tastes this different, an average tends to leave someone out; that is what the fair pick is for."
          : c.score < 0.7
            ? "Some overlap, but not everywhere, so the fair pick can differ from the average."
            : "You overlap a lot, so the fair pick and the average usually agree."}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Pair p={c.closest} label="Taste twins" colorOfName={colorOfName} />
        <Pair p={c.furthest} label="Furthest apart" colorOfName={colorOfName} />
      </div>
    </div>
  );
}

/** Compact per-member bars for runner-ups. */
function MiniMeter({ scores, colors }: { scores: MemberScore[]; colors: Colors }) {
  return (
    <div className="flex h-7 items-end gap-1" role="img" aria-label={scores.map((s) => `${s.member_name} ${pct(s.satisfaction)}`).join(", ")}>
      {scores.map((s) => (
        <span
          key={s.member_id}
          title={`${s.member_name}: ${pct(s.satisfaction)}`}
          className="w-2.5 rounded-sm"
          style={{ height: `${4 + Math.round(s.satisfaction * 24)}px`, background: colors[s.member_id] ?? "var(--muted)" }}
        />
      ))}
    </div>
  );
}

export default function Results({
  decision,
  colors,
  afterPick,
}: {
  decision: Decision;
  colors: Colors;
  /** actions shown right under the pick (share, adjust) */
  afterPick?: React.ReactNode;
}) {
  const byId = new Map(decision.ranked.map((r) => [r.entity.entity_id, r]));
  const picks = decision.picks.map((p) => ({ p, r: byId.get(p.entity_id) })).filter((x) => x.r) as {
    p: Decision["picks"][number];
    r: RankedCandidate;
  }[];
  const [top, ...rest] = picks;
  if (!top) return null;

  const maj = decision.majority;
  const differs = !!maj && maj.entity.entity_id !== top.r.entity.entity_id;
  const low = lowest(top.r.scores);
  const majLow = maj ? lowest(maj.scores) : undefined;
  const reasons = new Map(top.p.per_member.map((m) => [m.member_name, m.reason]));
  const hook = hookOf(top.p.headline, top.r.entity.name);
  const color = (id: string) => colors[id] ?? "var(--muted)";

  return (
    <section className="space-y-5" aria-live="polite">
      <article className="overflow-hidden rounded-3xl border border-line bg-card">
        {top.r.entity.image ? (
          <div className="h-52 overflow-hidden sm:h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={top.r.entity.image} alt="" className="size-full scale-105 object-cover" />
          </div>
        ) : null}
        <div className="space-y-3 p-5 sm:p-7">
          {decision.change_note && (
            <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm">
              <span className="font-semibold">Adjusted: </span>
              {decision.change_note}
            </p>
          )}
          <p className="text-sm font-semibold text-brand">Your fair pick</p>
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {top.r.entity.name}
            </h2>
            {(hook || top.r.entity.meta) && (
              <p className="mt-1 text-muted">{[hook, metaText(top.r.entity.meta)].filter(Boolean).join(". ")}</p>
            )}
            {top.r.entity.champion_of && (
              <p className="mt-2 inline-block rounded-full bg-soft px-2.5 py-0.5 text-xs font-medium">
                {broughtBy(top.r.entity.champion_of)}
              </p>
            )}
          </div>
          <p className="max-w-prose">{top.p.why_group}</p>
          {decision.calm_alternative && (
            <p className="max-w-prose rounded-xl bg-soft px-3 py-2 text-sm">
              You asked for calm. Qloo doesn&apos;t tag this place as calm or quiet; the calmest close option is{" "}
              <b>{decision.calm_alternative.name}</b> ({decision.calm_alternative.tags.join(", ")}), with nobody with a clear
              preference below {pct(decision.calm_alternative.lowest_match)}.
            </p>
          )}
          <KnownFor c={top.r} />
          <div className="pt-1">
            <NextStep c={top.r} />
          </div>
        </div>

        <div className="border-t border-line p-3 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 pb-1">
            <h3 className="font-display font-semibold">How well it fits each of you</h3>
            <details className="relative text-sm">
              <summary className="cursor-pointer list-none text-muted underline decoration-dotted underline-offset-4">
                What is a taste match?
              </summary>
              <p className="absolute right-0 z-10 mt-2 w-72 max-w-[80vw] rounded-xl border border-line bg-card p-3 text-xs text-muted shadow-lg">
                How high this option ranks for you among tonight&apos;s options, based on what fans of your favourites tend to like (Qloo). If Qloo sees little difference between the options for you, you&apos;re marked &ldquo;flexible tonight&rdquo;. It describes people with similar tastes, not a prediction about you.
                {decision.mode.qloo === "mock" && " This huddle uses the offline demo catalogue (fictional venues)."}
              </p>
            </details>
          </div>
          {top.r.scores.length > 1 && !low && (
            <p className="px-3 pb-2 text-sm text-muted">
              Everyone is flexible tonight: Qloo sees little difference between these options for any of you, so this
              is simply the best all-round fit.
            </p>
          )}
          <ul className="space-y-1">
            {top.r.scores.map((s) => (
              <MeterRow
                key={s.member_id}
                s={s}
                color={color(s.member_id)}
                reason={reasons.get(s.member_name)}
                protectedRow={top.r.scores.length > 1 && s.member_id === low?.member_id}
                ownTop={decision.personal_top?.[s.member_id] !== top.r.entity.name ? decision.personal_top?.[s.member_id] : undefined}
                rank={decision.shortlist_size && s.percentile !== undefined ? rankText(s.percentile, decision.shortlist_size) : undefined}
              />
            ))}
          </ul>
        </div>
      </article>

      {afterPick}

      {maj && (
        <div className="rounded-3xl bg-soft/70 p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold">
            {differs ? "Why not just take the average?" : "The simple average agrees"}
          </h3>
          {decision.tradeoff_note && <p className="mt-1 max-w-prose text-muted">{decision.tradeoff_note}</p>}
          {differs && majLow && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-card p-4">
                <p className="text-sm text-muted">A simple average would pick</p>
                <p className="mt-0.5 truncate font-semibold">{maj.entity.name}</p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Avatar name={majLow.member_name} color={color(majLow.member_id)} size="sm" />
                  {decision.shortlist_size && majLow.percentile !== undefined ? (
                    <>
                      only {majLow.member_name}&apos;s
                      <b className="font-display text-xl">{rankText(majLow.percentile, decision.shortlist_size)}</b>
                    </>
                  ) : (
                    <>
                      {majLow.member_name} drops to
                      <b className="font-display text-xl tabular-nums">{pct(majLow.satisfaction)}</b>
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted">{pct(majLow.satisfaction)} taste match</p>
              </div>
              <div className="rounded-2xl bg-accent/15 p-4">
                <p className="text-sm text-muted">TasteBridge picks</p>
                <p className="mt-0.5 truncate font-semibold">{top.r.entity.name}</p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {low && <Avatar name={low.member_name} color={color(low.member_id)} size="sm" />}
                  {decision.shortlist_size && majLow ? (
                    <>
                      {majLow.member_name}&apos;s
                      <b className="font-display text-xl">
                        {rankText(top.r.scores.find((x) => x.member_id === majLow.member_id)?.percentile ?? 0, decision.shortlist_size)}
                      </b>
                    </>
                  ) : (
                    <>
                      nobody with a clear preference below
                      <b className="font-display text-xl tabular-nums">{pct(top.r.min_satisfaction)}</b>
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted">nobody with a clear preference below {pct(top.r.min_satisfaction)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <TasteMap decision={decision} colors={colors} />

      <MoreDetail>
        {decision.compatibility && (
          <Compatibility c={decision.compatibility} colorOfName={(n) => color(top.r.scores.find((s) => s.member_name === n)?.member_id ?? "")} />
        )}
        <FairnessChart decision={decision} />
        {top.r.entity.type === "urn:entity:place" && <ShortlistMap decision={decision} />}
      </MoreDetail>

      {rest.length > 0 && (
        <div className="rounded-3xl border border-line bg-card p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold">Also worth a look</h3>
          <ul className="mt-2 divide-y divide-line">
            {rest.map(({ p, r }) => (
              <li key={p.entity_id} className="flex gap-4 py-3.5">
                {r.entity.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.entity.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-brand/10 font-display text-2xl font-semibold text-brand" aria-hidden>
                    {r.entity.name.replace(/^(the|a)\s+/i, "").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.entity.name}</p>
                      {(r.entity.meta || r.entity.champion_of) && (
                        <p className="text-sm text-muted">
                          {[metaText(r.entity.meta), broughtBy(r.entity.champion_of)].filter(Boolean).join(". ")}
                        </p>
                      )}
                    </div>
                    <MiniMeter scores={r.scores} colors={colors} />
                  </div>
                  <p className="mt-1 text-sm text-muted">{p.why_group}</p>
                  <p className="mt-1 text-xs text-muted">Lowest match {pct(r.min_satisfaction)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details id="how" className="border-t border-line pt-5 text-sm">
        <summary className="cursor-pointer font-display text-base font-semibold">
          How the agent decided <span className="font-sans text-sm font-normal text-muted">({decision.trace.length} steps)</span>
        </summary>
        <ol className="mt-3 space-y-2">
          {decision.trace.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-soft text-[11px] font-semibold">
                {i + 1}
              </span>
              <span>
                <span className="font-medium">{STEP_LABEL[t.tool] ?? t.tool}.</span>{" "}
                <span className="text-muted">{t.summary}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">
          How we pick: the option where the least-happy person with a clear preference is best off; on a near-tie, the one that is kindest
          to everyone. {decision.mode.agent === "claude" ? "Claude wrote the explanations using only these results." : "Simple rules wrote the explanations."}
        </p>
      </details>

      {decision.qloo_calls && decision.qloo_calls.length > 0 && (
        <details id="evidence" className="border-t border-line pt-5 text-sm">
          <summary className="cursor-pointer font-display text-base font-semibold">
            The exact Qloo requests{" "}
            <span className="font-sans text-sm font-normal text-muted">
              ({decision.qloo_calls.length} request{decision.qloo_calls.length === 1 ? "" : "s"},{" "}
              {decision.mode.qloo === "live" ? "live Qloo API" : "offline demo catalogue, not Qloo data"})
            </span>
          </summary>
          <p className="mt-2 text-xs text-muted">
            The exact requests behind this result. Entity id lists are summarised; no names or personal data are sent
            to Qloo, and the API key never leaves the server.
          </p>
          <ol className="mt-3 space-y-3">
            {decision.qloo_calls.map((c, i) => (
              <li key={i} className="rounded-2xl bg-soft p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <code className="font-semibold text-foreground">GET {c.endpoint}</code>
                  <span className="rounded-full border border-line px-1.5 text-muted">{c.source}</span>
                  <span className="text-muted">
                    {c.results} result{c.results === 1 ? "" : "s"} in {c.ms} ms
                  </span>
                </div>
                <dl className="mt-1.5 grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {Object.entries(c.params).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="truncate font-mono text-muted">{k}</dt>
                      <dd className="break-all font-mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
