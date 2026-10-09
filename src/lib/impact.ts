import "server-only";
import { supabase } from "./store";
import type { Decision, Huddle } from "./types";

export type Row = {
  kind: Huddle["kind"];
  is_demo: boolean;
  result: Decision | null;
  feedback: Huddle["feedback"] | null;
  members: { count: number }[] | null;
  answers: { q: "worked" | "clear" | "went"; a: "yes" | "no" }[] | null;
};

export type Rate = { yes: number; n: number };
export type ImpactStats = {
  groups: number;
  people: number;
  decisions: number;
  byKind: Record<Huddle["kind"], number>;
  differs: number;
  liftWhenDiffers: number | null;
  costWhenDiffers: number | null;
  refinedDecisions: number;
  worked: Rate;
  clear: Rate;
  went: Rate;
  demoGroups: number;
};

/** Aggregate, anonymous numbers from real (non-demo, production) huddles. */
export async function impactStats(): Promise<ImpactStats | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("huddles")
    .select("kind, is_demo, result, feedback, members(count), answers:feedback(q, a)")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error || !data) return null;
  return computeImpact(data as unknown as Row[]);
}

/** Pure aggregation, separated for testing. */
export function computeImpact(rows: Row[]): ImpactStats {
  const real = rows.filter((r) => !r.is_demo);
  const decided = real.filter((r) => r.result?.ranked?.length);
  const diffs = decided.filter((r) => r.result!.majority && r.result!.majority.entity.entity_id !== r.result!.ranked[0].entity.entity_id);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  type Answer = { q: "worked" | "clear" | "went"; a: "yes" | "no" };
  const normalise = (f: NonNullable<Huddle["feedback"]>[number]): Answer | null => {
    if (f.q && f.a) return { q: f.q, a: f.a };
    if (f.vote) return { q: "worked", a: f.vote === "up" ? "yes" : "no" };
    return null;
  };
  const rate = (q: Answer["q"]): Rate => {
    const answers = real
      .flatMap((r) => [...(r.feedback ?? []).map(normalise), ...(r.answers ?? [])])
      .filter((f): f is Answer => f !== null && f.q === q);
    return { yes: answers.filter((f) => f.a === "yes").length, n: answers.length };
  };
  return {
    groups: real.length,
    people: real.reduce((a, r) => a + (r.members?.[0]?.count ?? 0), 0),
    decisions: decided.length,
    byKind: {
      place: real.filter((r) => r.kind === "place").length,
      movie: real.filter((r) => r.kind === "movie").length,
      tv_show: real.filter((r) => r.kind === "tv_show").length,
    },
    differs: diffs.length,
    liftWhenDiffers: mean(diffs.map((r) => r.result!.ranked[0].min_satisfaction - r.result!.majority!.min_satisfaction)),
    costWhenDiffers: mean(diffs.map((r) => r.result!.majority!.mean_satisfaction - r.result!.ranked[0].mean_satisfaction)),
    refinedDecisions: decided.filter((r) => r.result!.refinements?.length).length,
    worked: rate("worked"),
    clear: rate("clear"),
    went: rate("went"),
    demoGroups: rows.length - real.length,
  };
}
