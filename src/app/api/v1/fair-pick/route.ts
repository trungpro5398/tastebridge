import * as z from "zod";
import { decideWithRules, ConstraintError } from "@/lib/decide";
import { QlooError, confidentMatch, searchEntities, withQlooLog } from "@/lib/qloo";
import type { Entity, EntityType, Huddle, RankedCandidate } from "@/lib/types";
import { allow, ipHash, tooMany } from "@/lib/usage";

export const maxDuration = 60;

const Body = z.object({
  kind: z.enum(["place", "movie", "tv_show"]),
  location: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(200).optional(),
  members: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        favourites: z.array(z.string().trim().min(1).max(80)).min(1).max(3),
      }),
    )
    .min(2)
    .max(8),
});

const FAVOURITE_TYPES: EntityType[] = [
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:artist",
  "urn:entity:book",
  "urn:entity:podcast",
  "urn:entity:videogame",
];

const option = (r: RankedCandidate) => ({
  entity_id: r.entity.entity_id,
  name: r.entity.name,
  meta: r.entity.meta,
  address: r.entity.address,
  lat: r.entity.lat,
  lon: r.entity.lon,
  lowest_match: r.min_satisfaction,
  average_match: r.mean_satisfaction,
  per_member: r.scores.map((s) => ({
    name: s.member_name,
    match: s.satisfaction,
    driven_by: s.because.map((b) => b.name),
  })),
});

/**
 * Fair group pick as a service, for booking, ticketing and team-event platforms.
 * Deterministic (no LLM): Qloo + the same maximin ranking the app uses.
 */
export async function POST(request: Request) {
  if (!allow(`api:${ipHash(request)}`, 20, 3_600_000)) return tooMany("API requests");
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  const input = parsed.data;

  try {
    const { result, calls } = await withQlooLog(async () => {
      const members = [];
      const unresolved: string[] = [];
      for (const [i, m] of input.members.entries()) {
        const picks: Entity[] = [];
        for (const f of m.favourites) {
          const hits = await searchEntities(f, FAVOURITE_TYPES, 3);
          const hit = hits.find((h) => confidentMatch(f, h.name));
          if (hit) picks.push(hit);
          else unresolved.push(f);
        }
        if (picks.length) members.push({ id: `api-${i}`, name: m.name, picks, joined_at: "" });
      }
      if (members.length < 2) throw new ConstraintError("Could not resolve favourites for at least 2 members.");
      const huddle: Huddle = {
        id: "api",
        title: "API request",
        kind: input.kind,
        location: input.kind === "place" ? (input.location ?? "Melbourne") : undefined,
        notes: input.notes,
        created_at: new Date().toISOString(),
        members,
      };
      return { decision: await decideWithRules(huddle), unresolved, resolved: members };
    });
    const d = result.decision;
    if (!d.ranked.length) return Response.json({ error: "No candidates matched. Try fewer constraints." }, { status: 422 });
    return Response.json({
      pick: option(d.ranked[0]),
      runner_ups: d.ranked.slice(1, 3).map(option),
      simple_average_pick: d.majority ? option(d.majority) : null,
      compatibility: d.compatibility ?? null,
      resolved_favourites: result.resolved.map((m) => ({ name: m.name, favourites: m.picks.map((p) => ({ name: p.name, type: p.type })) })),
      unresolved_favourites: result.unresolved,
      constraints_applied: {
        diet_tags: String(d.filters.tags ?? "").split(",").filter((t) => /vegetarian|vegan|gluten/.test(t)),
        price_level_max: d.filters.price_level_max ?? null,
        note:
          input.notes && !/vegetarian|vegan|gluten|\$/i.test(input.notes)
            ? "This endpoint applies diet and $-budget must-haves only; other requests need the in-app agent."
            : undefined,
      },
      provenance: { qloo: d.mode.qloo, calls },
      note: "Matches are within-shortlist percentiles of Qloo audience-level affinities, not predictions about individuals.",
    });
  } catch (err) {
    if (err instanceof ConstraintError) return Response.json({ error: err.message }, { status: 422 });
    if (err instanceof QlooError) return Response.json({ error: "The taste service is busy. Try again shortly." }, { status: 502 });
    throw err;
  }
}
