/**
 * Group-fair ranking.
 *
 * Each member i has an affinity a_i(c) for candidate c (Qloo /v2/insights scored with that
 * member's own taste signal, restricted to the shared shortlist via filter.results.entities).
 * Raw affinities are not comparable across people, so we convert them to a within-person
 * percentile s_i(c) ∈ [0,1] ("how high does c rank among tonight's options for i").
 *
 *   group choice = argmax_c  min_{i cares} s_i(c)  (maximin over people with a preference tonight;
 *                                                   everyone if nobody has one)
 *   near-ties    = within 3 points on that floor, prefer the higher minimum over everyone
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
  /** member_id -> credit from giving way on earlier outings (0–0.15) */
  credits: Record<string, number> = {},
): { ranked: RankedCandidate[]; majority: RankedCandidate | null } {
  if (!shortlist.length || !members.length) return { ranked: [], majority: null };

  const scoresByMember = members.map((m) => {
    const scored = new Map((perMember[m.id] ?? []).map((e) => [e.entity_id, e]));
    // an option Qloo didn't score for this person counts as their median, not as their worst
    const known = [...scored.values()].map((e) => e.affinity).sort((a, b) => a - b);
    const median = known.length ? known[Math.floor(known.length / 2)] : 0;
    const aff = shortlist.map((c) => scored.get(c.entity_id)?.affinity ?? median);
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
    // Flexible people's scores are mostly noise: they must not decide whom the pick protects.
    const cared = scores.filter((s) => !s.flexible).map((s) => s.satisfaction);
    return {
      entity,
      scores,
      min_satisfaction: Math.min(...(cared.length ? cared : sats)),
      // someone who gave way last time counts as a little worse off tonight, so the floor leans their way
      debt_floor: Math.min(
        ...(cared.length ? scores.filter((x) => !x.flexible) : scores).map((x) => x.satisfaction - (credits[x.member_id] ?? 0)),
      ),
      min_all: Math.min(...sats),
      mean_satisfaction: +(sats.reduce((a, b) => a + b, 0) / sats.length).toFixed(3),
      nash: +sats.reduce((p, s) => p * (EPS + s), 1).toFixed(6),
    };
  });

  const majority = [...ranked].sort(
    (a, b) => b.mean_satisfaction - a.mean_satisfaction || b.entity.affinity - a.entity.affinity,
  )[0];
  return { ranked: fairOrder(ranked), majority };
}

/** Carer floors this close count as equally protective (3 percentile points). */
export const FLOOR_TIE = 0.03;

/**
 * Greedy fair order. Each step takes the options whose floor among people who care is within
 * FLOOR_TIE of the best remaining floor, and among those prefers the one that is kindest to
 * everyone (highest minimum including flexible people), then Nash welfare. A large gain for someone
 * who cares always wins; a one-point gain can't be bought by dropping a flexible person far down.
 */
export function fairOrder(options: RankedCandidate[]): RankedCandidate[] {
  const rest = [...options];
  // a carried-over credit is small: it may break a close call, never override kindness to everyone
  const credit = Math.max(0, ...options.map((r) => r.min_satisfaction - (r.debt_floor ?? r.min_satisfaction)));
  const out: RankedCandidate[] = [];
  while (rest.length) {
    const floor = (r: RankedCandidate) => r.debt_floor ?? r.min_satisfaction;
    const best = Math.max(...rest.map(floor));
    const near = rest.filter((r) => floor(r) >= best - FLOOR_TIE - credit - 1e-9);
    // among close calls, options within 3 points on kindness to everyone count as equally kind;
    // among those, the credited floor decides (so a carried-over credit really breaks the tie)
    const all = (r: RankedCandidate) => r.min_all ?? r.min_satisfaction;
    const kindest = Math.max(...near.map(all));
    const kind = near.filter((r) => all(r) >= kindest - FLOOR_TIE - 1e-9);
    kind.sort((a, b) => floor(b) - floor(a) || all(b) - all(a) || b.nash - a.nash);
    out.push(kind[0]);
    rest.splice(rest.indexOf(kind[0]), 1);
  }
  return out;
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

/** Credit is half of how far below 65% someone was on an earlier pick, halved again per older outing, capped at 15 points. */
export const DEBT_BELOW = 0.65;
export const DEBT_CAP = 0.15;

/**
 * Who gave way on the group's earlier outings (newest first). Flexible people never earn credit:
 * they didn't really give anything up.
 */
export function carriedOver(history: { result?: import("./types").Decision | null }[]): import("./types").CarriedOver[] {
  const out = new Map<string, import("./types").CarriedOver>();
  history.slice(0, 3).forEach((h, age) => {
    const d = h.result;
    const pick = d?.ranked.find((r) => r.entity.entity_id === d.picks[0]?.entity_id);
    if (!pick) return;
    for (const s of pick.scores) {
      if (s.flexible || s.satisfaction >= DEBT_BELOW) continue;
      const credit = ((DEBT_BELOW - s.satisfaction) / 2) * 0.5 ** age;
      const prev = out.get(s.member_name);
      const total = Math.min(DEBT_CAP, (prev?.credit ?? 0) + credit);
      out.set(s.member_name, {
        member_name: s.member_name,
        previous_pick: prev?.previous_pick ?? pick.entity.name,
        previous_match: prev?.previous_match ?? s.satisfaction,
        credit: +total.toFixed(3),
      });
    }
  });
  return [...out.values()].filter((c) => c.credit >= 0.02);
}
