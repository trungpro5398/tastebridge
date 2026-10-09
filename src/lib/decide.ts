/**
 * The decision toolbox. Both the Claude agent (agent.ts) and the rule-based fallback drive
 * the same session object, so every number shown in the UI comes from Qloo + fairness.ts,
 * never from the language model.
 */
import "server-only";
import { groupCompatibility, rankFairly } from "./fairness";
import { highlights } from "./highlights";
import { DINNER_EXCLUDE, DINNER_TAG, compareTastes, findTags, insights, isDiningVenue, qlooMode } from "./qloo";
import {
  KIND_TO_TYPE,
  type Decision,
  type Huddle,
  type InsightEntity,
  type Pick,
  type RankedCandidate,
} from "./types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export class ConstraintError extends Error {}

export type CandidateOptions = {
  tags?: string[];
  avoidTags?: string[];
  preferTags?: string[];
  /** neighbourhood to centre on, e.g. "Fitzroy" */
  area?: string;
  maxKm?: number;
  priceMax?: number;
  popularityMax?: number;
  yearMin?: number;
  take?: number;
};

const DEFAULT_MAX_KM = 15;
/** Each person brings their own top matches to the table, so the shortlist is not only compromises. */
export const CHAMPIONS_EACH = 3;

/** "Bà likes it calm", "somewhere quiet": a vibe requirement enforced in code, not left to the agent. */
const CALM_ASK = /\b(calm|quiet|quieter|peaceful|relaxed|low[- ]key|not (too )?(loud|noisy))\b/i;
export const CALM_AVOID = [
  "urn:tag:ambience:qloo:loud",
  "urn:tag:ambience:qloo:noisy",
  "urn:tag:ambience:qloo:bustling",
  "urn:tag:ambience:qloo:lively",
  "urn:tag:ambience:place:lively",
];
const CALM_PREFER = ["urn:tag:ambience:qloo:calm", "urn:tag:ambience:qloo:quiet", "urn:tag:ambience:qloo:peaceful"];

/**
 * Ambience words an explanation may only use when the option's Qloo tags support them, so the
 * model cannot call a bustling venue "calm". Maps a word to the tag stem that must be present.
 */
const AMBIENCE_WORDS: Record<string, string> = {
  calm: "calm", calmer: "calm", quiet: "quiet", quieter: "quiet", peaceful: "peace", tranquil: "tranquil",
  serene: "seren", relaxed: "relax", relaxing: "relax", cozy: "coz", cosy: "coz", intimate: "intimate",
  romantic: "romantic", lively: "lively", bustling: "bustl", loud: "loud", noisy: "nois",
};

export function ungroundedAmbience(text: string, tagNames: string[]) {
  const tags = tagNames.map((t) => t.toLowerCase());
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return [...new Set(words.filter((w) => AMBIENCE_WORDS[w] && !tags.some((t) => t.includes(AMBIENCE_WORDS[w]))))];
}

export type Step = { tool: string; summary: string };
export type OnStep = (step: Step) => void;

export class DecisionSession {
  shortlist: InsightEntity[] = [];
  perMember: Record<string, InsightEntity[]> = {};
  ranked: RankedCandidate[] = [];
  majority: RankedCandidate | null = null;
  filters: Record<string, string | number> = {};
  trace: Decision["trace"] = [];
  picks: Pick[] | null = null;
  tradeoffNote = "";
  requiredTags: string[] | null = null;
  location?: string;
  changeNote = "";
  /** Claude token usage for this decision (set by the agent) */
  usage?: Decision["agent_usage"];

  constructor(
    readonly huddle: Huddle,
    private readonly onStep?: OnStep,
    /** follow-up requests from the group ("somewhere quieter", "no Japanese"), oldest first */
    readonly refinements: string[] = [],
    /** what the group was shown before this run, for "what changed" */
    readonly previous?: { entity_id: string; name: string },
  ) {}

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
    this.onStep?.({ tool, summary });
  }

  private tagCache = new Map<string, { id: string; name: string }[]>();

  async findTags(query: string) {
    const key = query.trim().toLowerCase();
    const hit = this.tagCache.get(key);
    if (hit) return hit;
    const tags = await findTags(query);
    this.tagCache.set(key, tags);
    const names = [...new Set(tags.map((t) => t.name))];
    const close = names.filter((n) => n.toLowerCase().includes(key));
    const shown = (close.length ? close : names).slice(0, 5);
    this.log("find_tags", `"${query}" → ${shown.join(", ") || "no matching Qloo tags"}`);
    return tags;
  }

  /** The must-haves or follow-ups ask for a calm or quiet place. */
  wantsCalm() {
    return CALM_ASK.test([this.huddle.notes ?? "", ...this.refinements].join(" "));
  }

  private lastTop: { id: string; name: string } | undefined;
  private lastRequest = "";
  /** True when the last group_candidates call repeated the previous request exactly. */
  repeated = false;

  async generateCandidates(opts: CandidateOptions = {}) {
    const request = JSON.stringify(opts, Object.keys(opts).sort());
    this.repeated = request === this.lastRequest && this.shortlist.length > 0 && this.picks === null;
    if (this.repeated) {
      this.log("group_candidates", "same request as before, so the same shortlist is reused (no extra Qloo calls)");
      return this.shortlist;
    }
    this.lastRequest = request;
    // Diet and budget requirements survive agent retries and API fallback.
    if (this.requiredTags === null) {
      const tags: string[] = [];
      // "Dinner spot" means restaurants, not bars or shops (live Qloo category tag).
      if (this.huddle.kind === "place" && DINNER_TAG) tags.push(DINNER_TAG);
      if (this.huddle.kind === "place") {
        for (const diet of ["vegetarian", "vegan", "gluten-free"]) {
          if (!this.huddle.notes?.toLowerCase().includes(diet)) continue;
          const matches = await this.findTags(diet);
          // "one vegetarian" means a place WITH vegetarian options, not a vegetarian-only restaurant
          const named = (t: { name: string }) => [diet, `${diet}-friendly`, `${diet} friendly`].includes(t.name.toLowerCase());
          const tag = matches.find((t) => t.id.includes(":dietary_option:") && named(t)) ?? matches.find(named);
          if (!tag) throw new ConstraintError(`Could not verify the ${diet} filter. Please revise the must-haves before deciding.`);
          tags.push(tag.id);
        }
      }
      this.requiredTags = tags;
    }
    const isPlace = this.huddle.kind === "place";
    const calm = isPlace && this.wantsCalm();
    const tags = [...new Set([...this.requiredTags, ...(opts.tags ?? [])])];
    const avoid = [
      ...new Set([...(isPlace ? DINNER_EXCLUDE : []), ...(calm ? CALM_AVOID : []), ...(opts.avoidTags ?? [])]),
    ].filter((t) => !tags.includes(t));
    const prefer = [...new Set([...(calm ? CALM_PREFER : []), ...(opts.preferTags ?? [])])];
    const budget = isPlace ? parsePrice(this.huddle.notes) : undefined;
    const priceMax = budget === undefined ? opts.priceMax : Math.min(budget, opts.priceMax ?? budget);
    // 30 options gives each person's percentile a finer, more stable scale
    const take = Math.min(Math.max(opts.take ?? 30, 6), 40);
    const location = isPlace && opts.area ? `${opts.area}, ${this.huddle.location ?? ""}`.replace(/, $/, "") : this.huddle.location;
    const maxKm = isPlace ? (opts.maxKm ?? DEFAULT_MAX_KM) : undefined;

    const query = (signal: string[], n: number) =>
      insights({
        type: this.type,
        signal,
        location,
        tags,
        avoidTags: avoid,
        preferTags: prefer,
        priceMax,
        popularityMax: opts.popularityMax,
        yearMin: opts.yearMin,
        // ask for more so the venue-type and distance filters still leave a full shortlist
        take: isPlace ? Math.min(n + 20, 50) : n,
      });
    const members = this.huddle.members.filter((m) => m.picks.length);
    const [raw, ...own] = await Promise.all([
      query(this.groupSignal(), take),
      ...(members.length > 1 ? members.map((m) => query(m.picks.map((p) => p.entity_id), CHAMPIONS_EACH * 2)) : []),
    ]);
    const avoidSet = new Set(avoid);
    const usable = (list: InsightEntity[]) =>
      (isPlace ? list.filter(isDiningVenue) : list).filter(
        (e) => !e.tags?.some((t) => avoidSet.has(t.id) || (calm && /^(loud|noisy|bustling|lively)$/i.test(t.name))),
      );
    const dining = usable(raw);
    const droppedNonDining = raw.length - dining.length;
    // everyone's own top matches go on the table first, then the group's shared-taste options
    const championOf = new Map<string, string[]>();
    const tops: InsightEntity[] = [];
    own.forEach((list, i) => {
      for (const e of usable(list).slice(0, CHAMPIONS_EACH)) {
        championOf.set(e.entity_id, [...(championOf.get(e.entity_id) ?? []), members[i].name]);
        if (!tops.some((t) => t.entity_id === e.entity_id)) tops.push(e);
      }
    });
    const merged = [...tops, ...dining.filter((e) => !championOf.has(e.entity_id))].map((e) =>
      championOf.has(e.entity_id) ? { ...e, champion_of: championOf.get(e.entity_id) } : e,
    );
    const { kept, droppedFar } = maxKm ? withinRadius(merged, maxKm) : { kept: merged, droppedFar: 0 };
    const next = kept.slice(0, take);
    const sameList =
      this.picks === null &&
      this.ranked.length > 0 &&
      next.length === this.shortlist.length &&
      next.every((e, i) => e.entity_id === this.shortlist[i].entity_id);
    if (sameList) {
      // different arguments, same options: keep the existing scores instead of re-scoring everyone
      this.repeated = true;
      this.log("group_candidates", "this request produced the same shortlist as before, so the existing scores are reused");
      return this.shortlist;
    }
    this.shortlist = next;
    const brought = this.shortlist.filter((e) => e.champion_of).length;
    this.location = location;
    this.filters = {
      type: this.type,
      ...(location && isPlace ? { location } : {}),
      ...(tags.length ? { tags: tags.join(",") } : {}),
      ...(avoid.length ? { avoid_tags: avoid.join(",") } : {}),
      ...(prefer.length ? { prefer_tags: prefer.join(",") } : {}),
      ...(priceMax ? { price_level_max: priceMax } : {}),
      ...(maxKm ? { max_km: maxKm } : {}),
      ...(opts.popularityMax ? { popularity_max: opts.popularityMax } : {}),
      ...(opts.yearMin ? { release_year_min: opts.yearMin } : {}),
    };
    this.ranked = [];
    this.perMember = {};
    this.majority = null;
    this.picks = null;
    this.tradeoffNote = "";
    this.changeNote = "";
    const label = (ids: string[]) => ids.map((t) => t.split(":").pop()?.replace(/[-_]/g, " ")).join(", ");
    this.log(
      "group_candidates",
      `${this.shortlist.length} candidates: ${brought ? `${brought} brought by individual members' own top matches, the rest ` : ""}from the group's combined taste` +
        (opts.area ? ` around ${opts.area}` : "") +
        (tags.length ? `, must be: ${label(tags)}` : "") +
        (opts.avoidTags?.length ? `, avoiding: ${label(opts.avoidTags)}` : "") +
        (calm ? ", calm required: no venues Qloo tags loud, noisy, bustling or lively" : "") +
        (prefer.length ? `, leaning towards: ${label(prefer)}` : "") +
        (priceMax ? `, price ≤ ${"$".repeat(priceMax)}` : "") +
        (opts.popularityMax ? ", off the beaten track" : "") +
        (opts.yearMin ? `, from ${opts.yearMin}` : "") +
        (droppedNonDining ? `; dropped ${droppedNonDining} drink-first or non-restaurant venues` : "") +
        (droppedFar ? `; dropped ${droppedFar} more than ${maxKm} km away` : ""),
    );
    return this.shortlist;
  }

  async scoreMembers() {
    if (!this.shortlist.length) return { ranked: [], majority: null };
    if (this.repeated && this.ranked.length) return { ranked: this.ranked, majority: this.majority };
    const ids = this.shortlist.map((c) => c.entity_id);
    const results = await Promise.all(
      this.huddle.members.map((m) =>
        insights({
          type: this.type,
          signal: m.picks.map((p) => p.entity_id),
          candidates: ids,
          location: this.location ?? this.huddle.location,
          take: ids.length,
        }).then((r) => [m.id, r] as const),
      ),
    );
    this.perMember = Object.fromEntries(results);
    const { ranked, majority } = rankFairly(this.shortlist, this.huddle.members, this.perMember);
    const before = this.lastTop;
    this.ranked = ranked;
    this.majority = majority;
    const top = ranked[0];
    this.lastTop = top && { id: top.entity.entity_id, name: top.entity.name };
    const sameTop = before && top && before.id === top.entity.entity_id;
    const moved = before && !sameTop ? ranked.find((r) => r.entity.entity_id === before.id) : undefined;
    this.log(
      "score_for_members",
      `scored ${ids.length} candidates × ${this.huddle.members.length} members; fairest: ${top?.entity.name} (lowest match ${pct(top?.min_satisfaction ?? 0)}), simple average: ${majority?.entity.name} (lowest match ${pct(majority?.min_satisfaction ?? 0)})` +
        (sameTop ? `; the fairest option did not change (percentages are relative to this longer list)` : "") +
        (before && !sameTop ? `; previous fairest ${before.name} ${moved ? `now has lowest match ${pct(moved.min_satisfaction)}` : "is not on this list"}` : ""),
    );
    return { ranked, majority };
  }

  /** Where two members' tastes agree/disagree over tonight's shortlist. */
  async compareMembers(a: string, b: string) {
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
    let analysis: unknown = null;
    if (qlooMode === "live") {
      try {
        analysis = await compareTastes(ma.picks.map((p) => p.entity_id), mb.picks.map((p) => p.entity_id), this.type);
        this.log("compare_tastes", `Qloo Analysis Compare: shared ${(analysis as { tag: string }[]).map((t) => t.tag).join(", ") || "no strong tags"}`);
      } catch {
        this.log("compare_tastes", "Qloo comparison unavailable; using the scored shortlist");
      }
    }
    this.log("compare_tastes", `${ma.name} vs ${mb.name}: ${both.length} options both like`);
    return {
      qloo_analysis: analysis,
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
        known_for: highlights(r.entity, 5),
        ...(r.entity.champion_of ? { top_match_for: r.entity.champion_of } : {}),
        lowest_taste_match_among_those_who_care: pct(r.min_satisfaction),
        ...cared(r),
        average: pct(r.mean_satisfaction),
        per_member: r.scores.map((s) => ({
          member: s.member_name,
          taste_match: pct(s.satisfaction),
          ...(s.flexible ? { flexible_tonight: true } : {}),
          driven_by_their_favourites: s.because.map((b) => b.name),
        })),
      })),
      average_vote_would_pick: this.majority && {
        name: this.majority.entity.name,
        lowest_taste_match_among_those_who_care: pct(this.majority.min_satisfaction),
        lowest_match_member: [...this.majority.scores].sort((a, b) => a.satisfaction - b.satisfaction)[0]?.member_name,
      },
    };
  }

  groupMessage = "";

  finalize(picks: Pick[], tradeoffNote: string, changeNote = "", groupMessage = "") {
    const expected = this.ranked.slice(0, 3);
    if (!expected.length || picks.length !== expected.length || picks.some((p, i) => p.entity_id !== expected[i].entity.entity_id))
      return "error: use exactly the top 3 (or all available) entity_ids in fair ranking order";
    for (const [i, p] of picks.entries()) {
      const tags = (expected[i].entity.tags ?? []).map((t) => t.name);
      const text = [p.headline, p.why_group, ...p.per_member.map((m) => m.reason)].join(" ");
      const bad = ungroundedAmbience(text, tags);
      if (bad.length)
        return `error: ${expected[i].entity.name} is described as "${bad.join('", "')}", but its Qloo tags do not say so (it is known for: ${highlights(expected[i].entity, 6).join(", ") || "nothing specific"}). Rewrite without that claim.`;
    }
    this.picks = picks;
    this.tradeoffNote = tradeoffNote;
    this.changeNote = changeNote;
    this.groupMessage = groupMessage;
    this.log("finalize", `${this.picks.length} picks`);
    return "saved";
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
      refinements: this.refinements.length ? this.refinements : undefined,
      previous_pick: this.previous?.name,
      change_note: this.refinements.length ? this.changeNote || ruleChange(this.previous, this.ranked[0]) : undefined,
      agent_usage: this.usage,
      group_message: this.groupMessage || ruleMessage(this.huddle, this.ranked[0]),
      compatibility: groupCompatibility(this.ranked),
      shortlist_size: this.ranked.length,
    };
  }
}

/** Lowest match among members who are not flexible tonight: the person the pick really protects. */
function cared(r: RankedCandidate) {
  const low = r.scores.filter((s) => !s.flexible).sort((a, b) => a.satisfaction - b.satisfaction)[0];
  return low ? { lowest_among_those_who_care: `${low.member_name} ${pct(low.satisfaction)}` } : {};
}

// ---------- rule-based explanations (no LLM) ----------
function rulePicks(ranked: RankedCandidate[]): Pick[] {
  return ranked.slice(0, 3).map((r) => ({
    entity_id: r.entity.entity_id,
    headline: r.entity.name,
    why_group: `Nobody with a preference tonight is below ${pct(r.min_satisfaction)}; group average ${pct(r.mean_satisfaction)}.`,
    per_member: r.scores.map((s) => ({
      member_name: s.member_name,
      reason: s.flexible
        ? `Qloo sees little difference between tonight's options for your taste, so you're flexible tonight; any of these suits you about equally.`
        : s.because.length
          ? `${pct(s.satisfaction)} taste match for you, driven mostly by ${s.because.map((b) => b.name).join(" and ")}.`
          : `A ${pct(s.satisfaction)} taste match for you, from your overall taste.`,
    })),
  }));
}

function ruleTradeoff(fair?: RankedCandidate, majority?: RankedCandidate | null) {
  if (!fair || !majority) return "";
  if (fair.entity.entity_id === majority.entity.entity_id)
    return `${fair.entity.name} is both the fairest option and the one a simple average would pick.`;
  const loser = [...majority.scores].filter((s) => !s.flexible).sort((a, b) => a.satisfaction - b.satisfaction)[0] ?? majority.scores[0];
  return `A simple average would pick ${majority.entity.name}, but ${loser.member_name}'s taste match there is only ${pct(loser.satisfaction)}. ${fair.entity.name} keeps everyone with a preference at ${pct(fair.min_satisfaction)} or higher.`;
}

export type RefineContext = { refinements?: string[]; previous?: { entity_id: string; name: string } };

export async function decideWithRules(huddle: Huddle, onStep?: OnStep, why?: string, ctx: RefineContext = {}): Promise<Decision> {
  const s = new DecisionSession(huddle, onStep, ctx.refinements, ctx.previous);
  if (why) s.log("agent", why);
  const opts = ctx.refinements?.length ? await refinementsByRules(s, ctx.refinements) : {};
  await s.generateCandidates({ priceMax: parsePrice(huddle.notes), ...opts });
  await s.scoreMembers();
  return s.toDecision("rules");
}

/** Without the LLM: "no X" → avoid tag, "closer"/"near X" → radius/area, "cheaper" → budget, anything else → preference. */
export async function refinementsByRules(s: DecisionSession, refinements: string[]): Promise<CandidateOptions> {
  const opts: CandidateOptions = { avoidTags: [], preferTags: [] };
  for (const clause of refinements.flatMap((r) => r.split(/,|;|\band\b/i)).map((c) => c.trim()).filter(Boolean)) {
    const lower = clause.toLowerCase();
    const neg = lower.match(/^(?:no|not|avoid|without|skip|nothing)\s+(.+)/);
    const near = lower.match(/\b(?:near|in|around)\s+([a-z][a-z .'-]+)$/);
    if (/\b(closer|nearby|walking distance|not too far|close by)\b/.test(lower)) opts.maxKm = 5;
    if (near && s.huddle.kind === "place") opts.area = near[1].replace(/\b\w/g, (c) => c.toUpperCase());
    if (/\b(cheaper|cheap|budget|less expensive)\b/.test(lower)) opts.priceMax = Math.max(1, (parsePrice(s.huddle.notes) ?? 3) - 1);
    if (/\b(surprise|adventurous|hidden gem|different|unusual)\b/.test(lower)) opts.popularityMax = 0.6;
    if (/\b(newer|recent|new)\b/.test(lower) && s.huddle.kind !== "place") opts.yearMin = new Date().getFullYear() - 8;
    if (near || /\b(closer|nearby|cheaper|cheap|budget|surprise|adventurous|hidden gem|different|unusual|newer|recent)\b/.test(lower)) continue;
    const term = (neg ? neg[1] : lower).replace(/\b(somewhere|something|place|food|please|more|a bit|bit)\b/g, "").trim();
    if (!term) continue;
    const [tag] = await s.findTags(term);
    if (tag) (neg ? opts.avoidTags! : opts.preferTags!).push(tag.id);
  }
  return opts;
}

function ruleMessage(huddle: Huddle, top?: RankedCandidate) {
  if (!top) return "";
  const where = top.entity.meta ? ` (${top.entity.meta.split(" · ").join(", ")})` : "";
  return `${huddle.title}: let's do ${top.entity.name}${where}. It's the fairest fit for all of us.`;
}

function ruleChange(prev: { entity_id: string; name: string } | undefined, now?: RankedCandidate) {
  if (!prev || !now) return "";
  return prev.entity_id === now.entity.entity_id
    ? `${now.entity.name} still fits best after your change.`
    : `Changed from ${prev.name} to ${now.entity.name}; everyone with a preference is at ${pct(now.min_satisfaction)} or higher.`;
}

/** Drop venues far from where the shortlist clusters (Qloo's city queries can reach 50 km out). */
export function withinRadius<T extends { lat?: number; lon?: number }>(items: T[], maxKm: number) {
  const pts = items.filter((i) => i.lat !== undefined && i.lon !== undefined);
  if (pts.length < 3) return { kept: items, droppedFar: 0 };
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const cLat = median(pts.map((p) => p.lat!));
  const cLon = median(pts.map((p) => p.lon!));
  const km = (p: T) =>
    Math.hypot((p.lat! - cLat) * 111.2, (p.lon! - cLon) * 111.2 * Math.cos((cLat * Math.PI) / 180));
  const kept = items.filter((i) => i.lat === undefined || i.lon === undefined || km(i) <= maxKm);
  return { kept, droppedFar: items.length - kept.length };
}

/** "under $$$" means cheaper than $$$ (≤ $$); "max $$" / "≤ $$" / "up to $$" include it. */
export function parsePrice(notes?: string) {
  const m = notes?.match(/(under|below|max|up to|≤|<=)\s*(\${1,4})/i);
  if (!m) return undefined;
  const n = m[2].length;
  return /under|below/i.test(m[1]) ? Math.max(1, n - 1) : n;
}
