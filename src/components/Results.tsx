import type { Decision, MemberScore, RankedCandidate } from "@/lib/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

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
    <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-soft text-2xl">✦</span>
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
      <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="bg-brand/10 px-5 py-2 text-xs font-medium uppercase tracking-wider text-brand">
          Tonight&apos;s fair pick
        </div>
        <div className="p-5">
          <div className="flex gap-4">
            <Thumb c={top.r} />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight">{top.p.headline}</h2>
              {top.r.entity.meta && <p className="text-sm text-muted">{top.r.entity.meta}</p>}
              <p className="mt-1 text-sm">{top.p.why_group}</p>
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
          <p className="text-sm font-medium">Why not just vote?</p>
          <p className="mt-1 text-sm text-muted">{decision.tradeoff_note}</p>
          {differs && maj && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
              <div className="rounded-xl bg-soft p-3">
                <p className="text-xs text-muted">Average vote</p>
                <p className="mt-0.5 truncate font-medium">{maj.entity.name}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{pct(maj.min_satisfaction)}</p>
                <p className="text-xs text-muted">least-happy person</p>
              </div>
              <div className="rounded-xl bg-accent/15 p-3">
                <p className="text-xs text-muted">TasteBridge</p>
                <p className="mt-0.5 truncate font-medium">{top.r.entity.name}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{pct(top.r.min_satisfaction)}</p>
                <p className="text-xs text-muted">least-happy person</p>
              </div>
            </div>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map(({ p, r }) => (
            <article key={p.entity_id} className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs text-muted">Also great · everyone ≥ {pct(r.min_satisfaction)}</p>
              <h3 className="mt-0.5 font-medium leading-snug">{p.headline}</h3>
              {r.entity.meta && <p className="text-xs text-muted">{r.entity.meta}</p>}
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

      <details className="rounded-2xl border border-line bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">How the agent decided</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          {decision.trace.map((t, i) => (
            <li key={i}>
              <code className="rounded bg-soft px-1 text-xs text-foreground">{t.tool}</code> {t.summary}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">
          Satisfaction = where an option ranks among tonight&apos;s shortlist for each person, scored by Qloo against
          that person&apos;s own favourites. The pick maximises the least-happy person&apos;s score (Nash welfare
          breaks ties). Data: {decision.mode.qloo === "live" ? "Qloo live" : "offline demo catalogue"} ·
          Explanations: {decision.mode.agent === "claude" ? "Claude agent" : "rules"}.
        </p>
      </details>
    </section>
  );
}
