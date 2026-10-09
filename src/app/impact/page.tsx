import type { Metadata } from "next";
import { Suspense } from "react";
import { impactStats, type Rate } from "@/lib/impact";

export const metadata: Metadata = {
  title: "Impact · TasteBridge",
  description: "Live, anonymous numbers from real TasteBridge groups, plus our evaluation on live Qloo data.",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function rateText(r: Rate) {
  return r.n ? `${pct(r.yes / r.n)}` : "–";
}

async function Live() {
  const s = await impactStats();
  if (!s)
    return <p className="text-muted">Live numbers need the production database. Run the app with Supabase configured.</p>;
  if (!s.groups)
    return (
      <p className="rounded-2xl border border-dashed border-line p-5 text-muted">
        No real groups yet. Numbers appear here as people use TasteBridge; demo and test runs are not counted.
      </p>
    );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Real groups" value={String(s.groups)} note={`${s.people} people joined`} />
        <Stat label="Decisions made" value={String(s.decisions)} />
        <Stat
          label="Fair pick ≠ average"
          value={s.decisions ? pct(s.differs / s.decisions) : "–"}
          note={s.liftWhenDiffers !== null ? `+${Math.round(s.liftWhenDiffers * 100)} pts for the least-matched person` : undefined}
        />
        <Stat label="Adjusted with the agent" value={s.decisions ? pct(s.refinedDecisions / s.decisions) : "–"} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="“Did this work for your group?”" value={rateText(s.worked)} note={`yes, of ${s.worked.n} answers`} />
        <Stat label="“Were the percentages clear?”" value={rateText(s.clear)} note={`yes, of ${s.clear.n} answers`} />
        <Stat label="“Did you go there?”" value={rateText(s.went)} note={`yes, of ${s.went.n} answers`} />
      </div>
      <p className="text-xs text-muted">
        Dinner {s.byKind.place}, movie {s.byKind.movie}, TV {s.byKind.tv_show}. {s.demoGroups} demo and test runs are
        excluded. Answers are anonymous one-tap buttons; no names or personal data are used here.
      </p>
    </div>
  );
}

export default function ImpactPage() {
  return (
    <div className="space-y-12 pt-8">
      <section>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Does fair picking help real groups?</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Two kinds of evidence: a controlled evaluation on live Qloo data, and live, anonymous numbers from groups using
          TasteBridge.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Evaluation on live Qloo data</h2>
        <p className="mt-1 text-sm text-muted">
          120 random groups of 3–5 people (60 dinner, 60 movie) in two runs, same pipeline as the app, no LLM.
          Synthetic groups.{" "}
          <a className="text-brand underline-offset-4 hover:underline" href="https://github.com/trungpro5398/tastebridge/blob/main/docs/EVALUATION.md">
            Method
          </a>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Fair pick ≠ average" value="40%" note="48 of 120 groups" />
          <Stat label="Lift for least-matched" value="+14.1" note="points, where they differ" />
          <Stat label="Cost to group average" value="−6.6" note="points, where they differ" />
          <Stat label="Flexible tonight" value="37%" note="of people: Qloo saw little difference for them" />
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Live, from real groups</h2>
        <div className="mt-4">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-soft" />}>
            <Live />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
