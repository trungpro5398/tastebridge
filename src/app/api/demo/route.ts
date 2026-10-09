import { QlooError, qlooMode, searchEntities } from "@/lib/qloo";
import { addMember, createHuddle, kvGet, kvSet } from "@/lib/store";
import { allow, ipHash, tooMany } from "@/lib/usage";
import type { Entity, EntityType } from "@/lib/types";

const M: EntityType = "urn:entity:movie";
const TV: EntityType = "urn:entity:tv_show";
const AR: EntityType = "urn:entity:artist";
const BK: EntityType = "urn:entity:book";

/** One-click demo huddle for judges: four friends with clashing tastes. */
const FRIENDS: { name: string; favourites: [string, EntityType][] }[] = [
  { name: "Mai", favourites: [["Spirited Away", M], ["Norah Jones", AR], ["Amélie", M]] },
  { name: "Josh", favourites: [["Mad Max: Fury Road", M], ["John Wick", M], ["Daft Punk", AR]] },
  { name: "Priya", favourites: [["Ratatouille", M], ["The Bear", TV], ["Salt Fat Acid Heat", BK]] },
  { name: "Leo", favourites: [["Parasite", M], ["Severance", TV], ["Radiohead", AR]] },
];

type Resolved = { name: string; picks: Entity[] }[];
const DEMO_KEY = `demo:v2:${qlooMode}`;

/** Resolve demo favourites once (sequentially, through the rate limiter) and reuse them for a week. */
async function demoFriends(): Promise<Resolved> {
  const cached = await kvGet<Resolved>(DEMO_KEY, 7 * 864e5).catch(() => null);
  if (cached?.length === FRIENDS.length) return cached;
  const out: Resolved = [];
  for (const f of FRIENDS) {
    const picks: Entity[] = [];
    for (const [n, t] of f.favourites) {
      const [hit] = await searchEntities(n, [t], 1);
      if (hit) picks.push({ entity_id: hit.entity_id, name: hit.name, type: hit.type, image: hit.image, meta: hit.meta, tags: hit.tags?.slice(0, 8) });
    }
    out.push({ name: f.name, picks });
  }
  await kvSet(DEMO_KEY, out).catch(() => {});
  return out;
}

export async function POST(request: Request) {
  if (!allow(`demo:${ipHash(request)}`, 15, 3_600_000)) return tooMany("demo huddles");
  let friends: Resolved;
  try {
    friends = await demoFriends();
  } catch (err) {
    if (err instanceof QlooError)
      return Response.json({ error: "The taste service is busy right now. Please try the demo again in a minute." }, { status: 503 });
    throw err;
  }
  const huddle = await createHuddle({
    title: "Friday dinner",
    kind: "place",
    location: "Melbourne",
    notes: "Keep it under $$$.",
    isDemo: true,
  });
  for (const f of friends) if (f.picks.length) await addMember(huddle.id, f.name, f.picks);
  return Response.json({ id: huddle.id }, { status: 201 });
}
