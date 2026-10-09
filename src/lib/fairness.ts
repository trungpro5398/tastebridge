/**
 * Group-fair ranking.
 *
 * Each member i has an affinity a_i(c) for candidate c (Qloo /v2/insights scored with that
 * member's own taste signal, restricted to the shared shortlist via filter.results.entities).
 * Raw affinities are not comparable across people, so we convert them to a within-person
 * percentile s_i(c) ∈ [0,1] ("how high does c rank among tonight's options for i").
 *
 *   group choice = argmax_c  min_i s_i(c)          (maximin / Rawlsian: protect the least-happy)
 *   tie-break    = argmax_c  Π_i (ε + s_i(c))      (Nash welfare: balanced, scale-free)
 *   baseline     = argmax_c  mean_i s_i(c)         (what averaging / majority vote would pick)
 */
import type { InsightEntity, Member, MemberScore, RankedCandidate } from "./types";

const EPS = 0.05;

/**
 * Qloo affinities share one 0–1 scale, so a tiny spread across tonight's shortlist means Qloo sees
 * little difference between the options for that person. Measured on live data (40 people): spread
 * p25 0.037, median 0.074, p90 0.159. Decisiveness d = spread / FULL_SPREAD (capped at 1); each
 * person's percentile is shrunk toward neutral by d, so noise can't masquerade as a strong preference
 * and maximin protects people who actually care.
 */
export const FULL_SPREAD = 0.1;
export const FLEXIBLE_BELOW = 0.5;

export function percentiles(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 1);
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
    const p = (i + j) / 2 / (n - 1); // average rank for ties
    for (let k = i; k <= j; k++) out[order[k][1]] = p;
    i = j + 1;
  }
  return out;
}

/**
 * Favourites that clearly drove a match. Qloo's explainability is often nearly flat across a
 * person's favourites; we only name one when it stands out (≥ 15% above that person's average).
 */
export function drivers(explain: Record<string, number>, pickName: Map<string, string>) {
  const mine = Object.entries(explain).filter(([id]) => pickName.has(id));
  if (!mine.length) return [];
  if (mine.length === 1) return [{ name: pickName.get(mine[0][0])!, weight: +mine[0][1].toFixed(3) }];
  const avg = mine.reduce((a, [, w]) => a + w, 0) / mine.length;
  return mine
    .filter(([, w]) => w >= avg * 1.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id, w]) => ({ name: pickName.get(id)!, weight: +w.toFixed(3) }));
}

export function rankFairly(
  shortlist: InsightEntity[],
  members: Member[],
  perMember: Record<string, InsightEntity[]>,
): { ranked: RankedCandidate[]; majority: RankedCandidate | null } {
  if (!shortlist.length || !members.length) return { ranked: [], majority: null };

  const scoresByMember = members.map((m) => {
    const scored = new Map((perMember[m.id] ?? []).map((e) => [e.entity_id, e]));
    const aff = shortlist.map((c) => scored.get(c.entity_id)?.affinity ?? 0);
    const pct = percentiles(aff);
    const spread = aff.length ? Math.max(...aff) - Math.min(...aff) : 0;
    const decisiveness = Math.min(1, spread / FULL_SPREAD);
    const pickName = new Map(m.picks.map((p) => [p.entity_id, p.name]));
    return shortlist.map<MemberScore>((c, idx) => {
      const explain = scored.get(c.entity_id)?.explain ?? {};
      return {
        member_id: m.id,
        member_name: m.name,
        affinity: +aff[idx].toFixed(4),
        percentile: +pct[idx].toFixed(3),
        satisfaction: +(0.5 + (pct[idx] - 0.5) * decisiveness).toFixed(3),
        decisiveness: +decisiveness.toFixed(2),
        flexible: decisiveness < FLEXIBLE_BELOW,
        because: drivers(explain, pickName),
      };
    });
  });

  const ranked = shortlist.map<RankedCandidate>((entity, idx) => {
    const scores = scoresByMember.map((row) => row[idx]);
    const sats = scores.map((s) => s.satisfaction);
    return {
      entity,
      scores,
      min_satisfaction: Math.min(...sats),
      mean_satisfaction: +(sats.reduce((a, b) => a + b, 0) / sats.length).toFixed(3),
      nash: +sats.reduce((p, s) => p * (EPS + s), 1).toFixed(6),
    };
  });

  const majority = [...ranked].sort(
    (a, b) => b.mean_satisfaction - a.mean_satisfaction || b.entity.affinity - a.entity.affinity,
  )[0];
  ranked.sort((a, b) => b.min_satisfaction - a.min_satisfaction || b.nash - a.nash);
  return { ranked, majority };
}

/** Pearson r from which two people's rankings count as clearly alike. */
export const TWINS_FROM = 0.3;

export type Compatibility = {
  /** 0..1: mean pairwise rank agreement over tonight's shortlist (0.5 = unrelated tastes) */
  score: number;
  pairs: { a: string; b: string; r: number }[];
  closest?: { a: string; b: string; r: number };
  furthest?: { a: string; b: string; r: number };
};

/**
 * How alike the group's tastes are: Pearson correlation of members' matches across the shortlist.
 * A flexible member's scores are mostly noise, so each pair is weighted by both people's
 * decisiveness, and "taste twins" / "furthest apart" are only named among people who care tonight.
 */
export function groupCompatibility(ranked: RankedCandidate[]): Compatibility | undefined {
  if (ranked.length < 4 || (ranked[0]?.scores.length ?? 0) < 2) return undefined;
  const members = ranked[0].scores.map((s) => ({
    id: s.member_id,
    name: s.member_name,
    d: s.decisiveness ?? 1,
    flexible: !!s.flexible,
  }));
  const series = members.map((m) => ranked.map((r) => r.scores.find((s) => s.member_id === m.id)?.satisfaction ?? 0));
  const corr = (x: number[], y: number[]) => {
    const mx = x.reduce((a, b) => a + b, 0) / x.length;
    const my = y.reduce((a, b) => a + b, 0) / y.length;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < x.length; i++) {
      num += (x[i] - mx) * (y[i] - my);
      dx += (x[i] - mx) ** 2;
      dy += (y[i] - my) ** 2;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
  };
  const pairs: Compatibility["pairs"] = [];
  const named: Compatibility["pairs"] = [];
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      const pair = { a: members[i].name, b: members[j].name, r: +corr(series[i], series[j]).toFixed(2) };
      const w = Math.max(0.05, members[i].d * members[j].d);
      pairs.push(pair);
      sum += w * pair.r;
      weight += w;
      if (!members[i].flexible && !members[j].flexible) named.push(pair);
    }
  const mean = sum / weight;
  const sorted = [...named].sort((p, q) => q.r - p.r);
  // Only call people "twins" when their rankings really move together, and "far apart" when they don't.
  const closest = sorted[0] && sorted[0].r >= TWINS_FROM ? sorted[0] : undefined;
  const last = sorted.at(-1);
  const furthest = last && last !== closest && last.r < TWINS_FROM ? last : undefined;
  return { score: +((mean + 1) / 2).toFixed(2), pairs, closest, furthest };
}
