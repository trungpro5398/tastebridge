/**
 * The decision toolbox. Both the Claude agent (agent.ts) and the rule-based fallback drive
 * the same session object, so every number shown in the UI comes from Qloo + fairness.ts,
 * never from the language model.
 */
import "server-only";
import { rankFairly } from "./fairness";
import { findTags, insights, qlooMode } from "./qloo";
import {
  KIND_TO_TYPE,
  type Decision,
  type Huddle,
  type InsightEntity,
  type Pick,
  type RankedCandidate,
} from "./types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export class DecisionSession {
  shortlist: InsightEntity[] = [];
  perMember: Record<string, InsightEntity[]> = {};
  ranked: RankedCandidate[] = [];
  majority: RankedCandidate | null = null;
  filters: Record<string, string | number> = {};
  trace: Decision["trace"] = [];
  picks: Pick[] | null = null;
  tradeoffNote = "";

  constructor(readonly huddle: Huddle) {}

  get type() {
    return KIND_TO_TYPE[this.huddle.kind];
  }

  /** Union of everyone's favourites, round-robin so no single member dominates the seed. */
  groupSignal(max = 15) {
    const lists = this.huddle.members.map((m) => m.picks.map((p) => p.entity_id));
    const out: string[] = [];
    for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++)
      for (const l of lists) if (l[i] && !out.includes(l[i])) out.push(l[i]);
    return out.slice(0, max);
  }

  log(tool: string, summary: string) {
    this.trace.push({ tool, summary });
  }

  async findTags(query: string) {
    const tags = await findTags(query);
    this.log("find_tags", `"${query}" → ${tags.map((t) => t.name).join(", ") || "none"}`);
    return tags;
  }

  async generateCandidates(opts: { tags?: string[]; priceMax?: number; take?: number } = {}) {
    const take = Math.min(Math.max(opts.take ?? 20, 6), 40);
    this.shortlist = await insights({
      type: this.type,
      signal: this.groupSignal(),
      location: this.huddle.location,
      tags: opts.tags,
      priceMax: opts.priceMax,
      take,
    });
    this.filters = {
      type: this.type,
      ...(this.huddle.location && this.huddle.kind === "place" ? { location: this.huddle.location } : {}),
      ...(opts.tags?.length ? { tags: opts.tags.join(",") } : {}),
      ...(opts.priceMax ? { price_level_max: opts.priceMax } : {}),
    };
    this.ranked = [];
    this.log(
      "group_candidates",
      `${this.shortlist.length} candidates from the group's combined taste` +
        (opts.tags?.length ? ` with tags ${opts.tags.join(", ")}` : "") +
        (opts.priceMax ? `, price ≤ ${"$".repeat(opts.priceMax)}` : ""),
    );
    return this.shortlist;
  }

  async scoreMembers() {
    if (!this.shortlist.length) throw new Error("No shortlist yet: call group_candidates first.");
    const ids = this.shortlist.map((c) => c.entity_id);
    const results = await Promise.all(
      this.huddle.members.map((m) =>
        insights({
          type: this.type,
          signal: m.picks.map((p) => p.entity_id),
          candidates: ids,
          location: this.huddle.location,
          take: ids.length,
        }).then((r) => [m.id, r] as const),
      ),
    );
    this.perMember = Object.fromEntries(results);
    const { ranked, majority } = rankFairly(this.shortlist, this.huddle.members, this.perMember);
    this.ranked = ranked;
    this.majority = majority;
    const top = ranked[0];
    this.log(
      "score_for_members",
      `scored ${ids.length} candidates × ${this.huddle.members.length} members; fairest: ${top?.entity.name} (least-happy ${pct(top?.min_satisfaction ?? 0)}), average-vote: ${majority?.entity.name} (least-happy ${pct(majority?.min_satisfaction ?? 0)})`,
    );
    return { ranked, majority };
  }

  /** Where two members' tastes agree/disagree over tonight's shortlist. */
  compareMembers(a: string, b: string) {
    const find = (n: string) => this.huddle.members.find((m) => m.name.toLowerCase() === n.toLowerCase());
    const ma = find(a);
    const mb = find(b);
    if (!ma || !mb) return { error: `Unknown member. Members: ${this.huddle.members.map((m) => m.name).join(", ")}` };
    const rows = this.ranked.map((r) => ({
      name: r.entity.name,
      a: r.scores.find((s) => s.member_id === ma.id)!.satisfaction,
      b: r.scores.find((s) => s.member_id === mb.id)!.satisfaction,
    }));
    const both = rows.filter((r) => r.a >= 0.6 && r.b >= 0.6).map((r) => r.name);
    const split = [...rows].sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 3);
    const tagsA = new Set(ma.picks.flatMap((p) => p.tags?.map((t) => t.name) ?? []));
    const sharedTags = [...new Set(mb.picks.flatMap((p) => p.tags?.map((t) => t.name) ?? []))].filter((t) =>
      tagsA.has(t),
    );
    this.log("compare_tastes", `${ma.name} vs ${mb.name}: ${both.length} options both like`);
    return {
      both_like: both.slice(0, 5),
      biggest_disagreements: split.map((r) => `${r.name} (${ma.name} ${pct(r.a)} vs ${mb.name} ${pct(r.b)})`),
      shared_taste_tags: sharedTags.slice(0, 8),
    };
  }

  /** Compact table for the model: real numbers only. */
  rankingTable(n = 6) {
    return {
      fair_ranking: this.ranked.slice(0, n).map((r) => ({
        entity_id: r.entity.entity_id,
        name: r.entity.name,
        meta: r.entity.meta,
        tags: r.entity.tags?.slice(0, 6).map((t) => t.name),
        least_happy: pct(r.min_satisfaction),
        average: pct(r.mean_satisfaction),
        per_member: r.scores.map((s) => ({
          member: s.member_name,
          satisfaction: pct(s.satisfaction),
          driven_by_their_favourites: s.because.map((b) => b.name),
        })),
      })),
      average_vote_would_pick: this.majority && {
        name: this.majority.entity.name,
        least_happy: pct(this.majority.min_satisfaction),
        unhappiest_member: [...this.majority.scores].sort((a, b) => a.satisfaction - b.satisfaction)[0]?.member_name,
      },
    };
  }

  finalize(picks: Pick[], tradeoffNote: string) {
    const known = new Set(this.ranked.map((r) => r.entity.entity_id));
    this.picks = picks.filter((p) => known.has(p.entity_id)).slice(0, 3);
    this.tradeoffNote = tradeoffNote;
    this.log("finalize", `${this.picks.length} picks`);
    return this.picks.length ? "saved" : "error: entity_ids must come from the fair ranking";
  }

  toDecision(agent: "claude" | "rules"): Decision {
    const picks = this.picks?.length ? this.picks : rulePicks(this.ranked);
    return {
      created_at: new Date().toISOString(),
      mode: { qloo: qlooMode, agent },
      filters: this.filters,
      ranked: this.ranked.slice(0, 10),
      majority: this.majority,
      picks,
      tradeoff_note: this.tradeoffNote || ruleTradeoff(this.ranked[0], this.majority),
      trace: this.trace,
    };
  }
}

// ---------- rule-based explanations (no LLM) ----------
function rulePicks(ranked: RankedCandidate[]): Pick[] {
  return ranked.slice(0, 3).map((r) => ({
    entity_id: r.entity.entity_id,
    headline: r.entity.name,
    why_group: `Everyone lands at ${pct(r.min_satisfaction)} or better; group average ${pct(r.mean_satisfaction)}.`,
    per_member: r.scores.map((s) => ({
      member_name: s.member_name,
      reason: s.because.length
        ? `Matches your love of ${s.because.map((b) => b.name).join(" and ")} (${pct(s.satisfaction)} for you).`
        : `A ${pct(s.satisfaction)} fit for you among tonight's options.`,
    })),
  }));
}

function ruleTradeoff(fair?: RankedCandidate, majority?: RankedCandidate | null) {
  if (!fair || !majority) return "";
  if (fair.entity.entity_id === majority.entity.entity_id)
    return `${fair.entity.name} is both the fairest option and the one an average vote would pick.`;
  const loser = [...majority.scores].sort((a, b) => a.satisfaction - b.satisfaction)[0];
  return `An average vote would pick ${majority.entity.name}, but ${loser.member_name} would only be at ${pct(loser.satisfaction)}. ${fair.entity.name} keeps everyone at ${pct(fair.min_satisfaction)} or above.`;
}

export async function decideWithRules(huddle: Huddle): Promise<Decision> {
  const s = new DecisionSession(huddle);
  await s.generateCandidates({ priceMax: parsePrice(huddle.notes) });
  await s.scoreMembers();
  return s.toDecision("rules");
}

function parsePrice(notes?: string) {
  const m = notes?.match(/(?:under|max|≤|<=)\s*(\${1,4})/i);
  return m ? m[1].length : undefined;
}
