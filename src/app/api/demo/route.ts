import { QlooError, confidentMatch, normaliseName, qlooMode, searchEntities } from "@/lib/qloo";
import { addMember, createHuddle, kvGet, kvSet } from "@/lib/store";
import { allow, ipHash, tooMany } from "@/lib/usage";
import type { Entity, EntityType } from "@/lib/types";

const M: EntityType = "urn:entity:movie";
const TV: EntityType = "urn:entity:tv_show";
const AR: EntityType = "urn:entity:artist";

type Scenario = {
  kind: "place" | "movie";
  title: string;
  notes: string;
  friends: { name: string; favourites: [string, EntityType][] }[];
};

/** One-click demo huddles for judges. */
const SCENARIOS: Record<"friends" | "family", Scenario> = {
  // four friends with clashing tastes, choosing a film
  friends: {
    kind: "movie",
    title: "Friday movie night",
    notes: "",
    friends: [
      { name: "Mai", favourites: [["Spirited Away", M], ["Norah Jones", AR], ["Amélie", M]] },
      { name: "Josh", favourites: [["Mad Max: Fury Road", M], ["John Wick", M], ["Daft Punk", AR]] },
      { name: "Priya", favourites: [["Ratatouille", M], ["The Bear", TV], ["Chef's Table", TV]] },
      { name: "Leo", favourites: [["Parasite", M], ["Severance", TV], ["Radiohead", AR]] },
    ],
  },
  // a Vietnamese-Australian family in Melbourne: grandmother, parents, teenager
  family: {
    kind: "place",
    title: "Sunday lunch, three generations",
    notes: "Grandma likes it calm. Under $$$.",
    friends: [
      { name: "Grandma Lan", favourites: [["Khánh Ly", AR], ["Trịnh Công Sơn", AR], ["The Scent of Green Papaya", M]] },
      { name: "Minh", favourites: [["Anthony Bourdain: Parts Unknown", TV], ["The Rolling Stones", AR], ["Heat", M]] },
      { name: "Linh", favourites: [["The Great British Baking Show", TV], ["Celine Dion", AR], ["Pride and Prejudice", M]] },
      { name: "Mai", favourites: [["Spider-Man: Into the Spider-Verse", M], ["BTS", AR], ["Stranger Things", TV]] },
    ],
  },
};

type Resolved = { name: string; picks: Entity[] }[];
const demoKey = (scenario: string) => `demo:v7:${scenario}:${qlooMode}`;

/** Resolve demo favourites once (sequentially, through the rate limiter) and reuse them for a week. */
async function demoFriends(scenario: keyof typeof SCENARIOS): Promise<Resolved> {
  const friends = SCENARIOS[scenario].friends;
  const cached = await kvGet<Resolved>(demoKey(scenario), 7 * 864e5).catch(() => null);
  if (cached?.length === friends.length) return cached;
  const out: Resolved = [];
  for (const f of friends) {
    const picks: Entity[] = [];
    for (const [n, t] of f.favourites) {
      const hits = await searchEntities(n, [t], 5);
      // prefer the exact title ("The Great British Bake Off", not a spin-off), then a confident match
      const exact = hits.find((h) => normaliseName(h.name) === normaliseName(n));
      const hit = qlooMode === "live" ? exact ?? hits.find((h) => confidentMatch(n, h.name)) : hits[0];
      if (hit) picks.push({ entity_id: hit.entity_id, name: hit.name, type: hit.type, image: hit.image, meta: hit.meta, tags: hit.tags?.slice(0, 8) });
    }
    out.push({ name: f.name, picks });
  }
  await kvSet(demoKey(scenario), out).catch(() => {});
  return out;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { scenario?: string };
  const scenario = body.scenario === "family" ? "family" : "friends";
  if (!allow(`demo:${ipHash(request)}`, 15, 3_600_000)) return tooMany("demo huddles");
  let friends: Resolved;
  try {
    friends = await demoFriends(scenario);
  } catch (err) {
    if (err instanceof QlooError)
      return Response.json({ error: "The taste service is busy right now. Please try the demo again in a minute." }, { status: 503 });
    throw err;
  }
  const huddle = await createHuddle({
    title: SCENARIOS[scenario].title,
    kind: SCENARIOS[scenario].kind,
    location: SCENARIOS[scenario].kind === "place" ? "Melbourne" : undefined,
    notes: SCENARIOS[scenario].notes,
    isDemo: true,
  });
  for (const f of friends) if (f.picks.length) await addMember(huddle.id, f.name, f.picks);
  return Response.json({ id: huddle.id }, { status: 201 });
}
