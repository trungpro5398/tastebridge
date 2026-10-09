import { searchEntities } from "@/lib/qloo";
import { allow, ipHash, tooMany } from "@/lib/usage";
import type { EntityType } from "@/lib/types";

const ALLOWED = new Set<EntityType>([
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:artist",
  "urn:entity:book",
  "urn:entity:place",
  "urn:entity:podcast",
  "urn:entity:videogame",
]);

const FAVOURITE_TYPES: EntityType[] = [
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:artist",
  "urn:entity:book",
  "urn:entity:podcast",
  "urn:entity:videogame",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json([]);
  if (!allow(`search:${ipHash(request)}`, 40, 60_000)) return tooMany("searches");
  const types = (url.searchParams.get("types") ?? "")
    .split(",")
    .filter((t): t is EntityType => ALLOWED.has(t as EntityType));
  // Favourites: cultural taste signals only (no albums/people duplicates, no venues).
  const results = await searchEntities(q.slice(0, 80), types.length ? types : FAVOURITE_TYPES, 8);
  // the picker needs a small payload; tags stay server-side except a few for explanations
  return Response.json(
    results.map(({ entity_id, name, type, image, meta, tags }) => ({ entity_id, name, type, image, meta, tags: tags?.slice(0, 12) })),
  );
}
