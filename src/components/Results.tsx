import { highlights } from "@/lib/highlights";
import type { Decision, MemberScore, RankedCandidate } from "@/lib/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const TYPE_EMOJI: Record<string, string> = {
  "urn:entity:place": "🍽️",
  "urn:entity:movie": "🎬",
  "urn:entity:tv_show": "📺",
};

function Bar({ s, highlight }: { s: MemberScore; highlight?: boolean }) {
  const v = Math.round(s.satisfaction * 100);
  const tone = v >= 70 ? "bg-accent" : v >= 45 ? "bg-amber-500" : "bg-brand";
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.75rem] items-center gap-2 text-sm">
      <span className={`truncate ${highlight ? "font-semibold" : ""}`}>{s.member_name}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-soft" aria-hidden>
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(v, 4)}%` }} />
      </span>
      <span className="text-right tabular-nums text-muted">{v}%</span>
    </div>
  );
}

function Thumb({ c }: { c: RankedCandidate }) {
  return c.entity.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.entity.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
  ) : (
    <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-soft text-2xl">
      {TYPE_EMOJI[c.entity.type] ?? "✦"}
    </span>
  );
}

function KnownFor({ c, n = 4 }: { c: RankedCandidate; n?: number }) {
  const tags = highlights(c.entity, n);
  if (!tags.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Known for">
      {tags.map((t) => (
        <li key={t} className="rounded-full bg-soft px-2 py-0.5 text-xs text-muted">
          {t}
        </li>
      ))}
    </ul>
  );
}

/** The obvious next action once the group has a pick. */
function NextStep({ c }: { c: RankedCandidate }) {
  const q = encodeURIComponent([c.entity.name, c.entity.address ?? c.entity.meta?.split(" · ")[0]].filter(Boolean).join(" "));
  const isPlace = c.entity.type === "urn:entity:place";
  const href = isPlace
    ? `https://www.google.com/maps/search/?api=1&query=${q}`
    : `https://www.justwatch.com/au/search?q=${encodeURIComponent(c.entity.name)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-soft"
    >
      {isPlace ? "📍 Open in Maps" : "▶ Where to watch"}
    </a>
  );
}

export default function Results({ decision }: { decision: Decision }) {
  const byId = new Map(decision.ranked.map((r) => [r.entity.entity_id, r]));
  const picks = decision.picks.map((p) => ({ p, r: byId.get(p.entity_id) })).filter((x) => x.r) as {
    p: Decision["picks"][number];
    r: RankedCandidate;
  }[];
  const [top, ...rest] = picks;
  const maj = decision.majority;
  const differs = maj && top && maj.entity.entity_id !== top.r.entity.entity_id;

  if (!top) return null;
  const minName = [...top.r.scores].sort((a, b) => a.satisfaction - b.satisfaction)[0]?.member_name;

  return (
    <section className="space-y-4" aria-live="polite">
      <p className="text-xs text-muted">
        Taste match = how an option ranks within tonight&apos;s shortlist for each person&apos;s favourites, using Qloo&apos;s
        audience-level affinities. It describes what people with similar tastes tend to like, not a prediction about any one person.
        {decision.mode.qloo === "mock" && " Demo data: venues are fictional and location is not applied."}
        {decision.mode.agent === "rules" && " Rules mode checks supported diet tags and dollar-sign budgets; review any other must-haves yourself."}
      </p>
      <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="bg-brand/10 px-5 py-2 text-xs font-medium uppercase tracking-wider text-brand">
          Tonight&apos;s fair pick
        </div>
        {top.r.entity.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={top.r.entity.image} alt="" className="h-48 w-full object-cover sm:h-56" />
        )}
        <div className="p-5">
          <div className="flex gap-4">
            {!top.r.entity.image && <Thumb c={top.r} />}
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight">{top.p.headline}</h2>
              {top.r.entity.meta && <p className="text-sm text-muted">{top.r.entity.meta}</p>}
              <p className="mt-1 text-sm">{top.p.why_group}</p>
              <KnownFor c={top.r} />
              <NextStep c={top.r} />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {top.r.scores.map((s) => (
              <Bar key={s.member_id} s={s} highlight={s.member_name === minName} />
            ))}
          </div>
          <ul className="mt-5 space-y-2 text-sm">
            {top.p.per_member.map((m) => (
              <li key={m.member_name}>
                <span className="font-medium">{m.member_name}:</span> <span className="text-muted">{m.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </article>

      {decision.tradeoff_note && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="text-sm font-medium">Why not just take the average?</p>
          <p className="mt-1 text-sm text-muted">{decision.tradeoff_note}</p>
          {differs && maj && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
              <div className="rounded-xl bg-soft p-3">
                <p className="text-xs text-muted">Simple average</p>
                <p className="mt-0.5 truncate font-medium">{maj.entity.name}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{pct(maj.min_satisfaction)}</p>
                <p className="text-xs text-muted">lowest taste match</p>
              </div>
              <div className="rounded-xl bg-accent/15 p-3">
                <p className="text-xs text-muted">TasteBridge</p>
                <p className="mt-0.5 truncate font-medium">{top.r.entity.name}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{pct(top.r.min_satisfaction)}</p>
                <p className="text-xs text-muted">lowest taste match</p>
              </div>
            </div>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map(({ p, r }) => (
            <article key={p.entity_id} className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs text-muted">Runner-up · lowest match {pct(r.min_satisfaction)}</p>
              <h3 className="mt-0.5 font-medium leading-snug">{p.headline}</h3>
              {r.entity.meta && <p className="text-xs text-muted">{r.entity.meta}</p>}
              <KnownFor c={r} n={3} />
              <p className="mt-1 text-sm text-muted">{p.why_group}</p>
              <div className="mt-3 space-y-1.5">
                {r.scores.map((s) => (
                  <Bar key={s.member_id} s={s} />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <details id="how" className="rounded-2xl border border-line bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">How the agent decided</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          {decision.trace.map((t, i) => (
            <li key={i}>
              <code className="rounded bg-soft px-1 text-xs text-foreground">{t.tool}</code> {t.summary}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">
          Each person&apos;s taste match is the option&apos;s percentile within tonight&apos;s shortlist when Qloo scores
          it against that person&apos;s favourites. The pick maximises the lowest match (Nash welfare breaks ties).
          Explanations: {decision.mode.agent === "claude" ? "Claude agent, limited to tool output" : "rules"}.
        </p>
      </details>

      {decision.qloo_calls && decision.qloo_calls.length > 0 && (
        <details id="evidence" className="rounded-2xl border border-line bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            Qloo evidence{" "}
            <span className="font-normal text-muted">
              ({decision.qloo_calls.length} request{decision.qloo_calls.length === 1 ? "" : "s"} ·{" "}
              {decision.mode.qloo === "live" ? "live Qloo API" : "offline demo catalogue, not Qloo data"})
            </span>
          </summary>
          <p className="mt-2 text-xs text-muted">
            Exact requests behind this result. Entity id lists are summarised; no names or personal data are sent to
            Qloo, and the API key never leaves the server.
          </p>
          <ol className="mt-3 space-y-3">
            {decision.qloo_calls.map((c, i) => (
              <li key={i} className="rounded-xl bg-soft p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <code className="font-semibold text-foreground">GET {c.endpoint}</code>
                  <span className="rounded-full border border-line px-1.5 text-muted">{c.source}</span>
                  <span className="text-muted">
                    → {c.results} result{c.results === 1 ? "" : "s"} · {c.ms} ms
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
