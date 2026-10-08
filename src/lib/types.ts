export type EntityType =
  | "urn:entity:movie"
  | "urn:entity:tv_show"
  | "urn:entity:artist"
  | "urn:entity:book"
  | "urn:entity:place"
  | "urn:entity:podcast"
  | "urn:entity:video_game";

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
  feedback?: { vote: "up" | "down"; at: string }[];
};

export type MemberScore = {
  member_id: string;
  member_name: string;
  /** raw Qloo affinity of this candidate for this member's taste */
  affinity: number;
  /** percentile of this candidate among tonight's candidates for this member, 0..1 */
  satisfaction: number;
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
};
