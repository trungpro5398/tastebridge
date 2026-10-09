export type EntityType =
  | "urn:entity:movie"
  | "urn:entity:tv_show"
  | "urn:entity:artist"
  | "urn:entity:book"
  | "urn:entity:place"
  | "urn:entity:podcast"
  | "urn:entity:videogame";

/** What the group is deciding on tonight. */
export type HuddleKind = "place" | "movie" | "tv_show";

export const KIND_TO_TYPE: Record<HuddleKind, EntityType> = {
  place: "urn:entity:place",
  movie: "urn:entity:movie",
  tv_show: "urn:entity:tv_show",
};

export type Entity = {
  entity_id: string;
  name: string;
  type: EntityType | string;
  image?: string;
  description?: string;
  tags?: { id: string; name: string }[];
  meta?: string;
  /** full street address (places), for map links */
  address?: string;
  /** coordinates (places), for the map */
  lat?: number;
  lon?: number;
  website?: string;
  /** Qloo marks permanently closed venues */
  closed?: boolean;
  /** Qloo's primary genre tag for places, e.g. urn:tag:genre:place:restaurant:italian */
  primaryGenre?: string;
};

/** A candidate as returned by /v2/insights, plus explainability. */
export type InsightEntity = Entity & {
  affinity: number;
  popularity?: number;
  /** input entity_id -> contribution (0..1) */
  explain: Record<string, number>;
};

export type Member = {
  id: string;
  name: string;
  picks: Entity[];
  joined_at: string;
};

export type Huddle = {
  id: string;
  title: string;
  kind: HuddleKind;
  location?: string;
  notes?: string;
  created_at: string;
  members: Member[];
  result?: Decision | null;
  /** a decision is being computed right now (another viewer pressed the button) */
  deciding?: boolean;
  feedback?: { q?: "worked" | "clear" | "went"; a?: "yes" | "no"; vote?: "up" | "down"; at: string }[];
};

export type MemberScore = {
  member_id: string;
  member_name: string;
  /** raw Qloo affinity of this candidate for this member's taste */
  affinity: number;
  /** raw within-shortlist percentile for this member, 0..1 */
  percentile?: number;
  /**
   * taste match shown to people and used by the fair ranking: the percentile shrunk toward 0.5 by
   * how decisive this person's Qloo scores are tonight (see fairness.ts)
   */
  satisfaction: number;
  /** 0..1: how much Qloo's scores for this person differ across tonight's options */
  decisiveness?: number;
  /** Qloo sees little difference between options for this person tonight */
  flexible?: boolean;
  /** which of the member's favourites drove the match, strongest first */
  because: { name: string; weight: number }[];
};

export type RankedCandidate = {
  entity: InsightEntity;
  scores: MemberScore[];
  min_satisfaction: number;
  mean_satisfaction: number;
  nash: number;
};

export type Pick = {
  entity_id: string;
  headline: string;
  why_group: string;
  per_member: { member_name: string; reason: string }[];
};

/** One Qloo request as shown to users/judges: endpoint, redacted params, result count. */
export type QlooCall = {
  endpoint: string;
  params: Record<string, string>;
  results: number;
  source: "qloo" | "cache" | "offline";
  ms: number;
};

export type Decision = {
  created_at: string;
  mode: { qloo: "live" | "mock"; agent: "claude" | "rules" };
  filters: Record<string, string | number>;
  ranked: RankedCandidate[];
  /** what plain majority/average voting would pick */
  majority: RankedCandidate | null;
  picks: Pick[];
  tradeoff_note: string;
  trace: { tool: string; summary: string }[];
  /** redacted log of the Qloo requests behind this decision */
  qloo_calls?: QlooCall[];
  /** follow-up requests from the group that shaped this run, oldest first */
  refinements?: string[];
  previous_pick?: string;
  /** what changed versus the previous pick, and why */
  change_note?: string;
  /** ready-to-send message for the group chat */
  group_message?: string;
  /** how alike the group's tastes are across the shortlist */
  compatibility?: import("./fairness").Compatibility;
  /** Claude tokens spent on this decision */
  agent_usage?: { calls: number; input: number; cacheRead: number; cacheWrite: number; output: number; usd: number; model: string };
};
