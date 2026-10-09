import { searchEntities } from "@/lib/qloo";
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
  const types = (url.searchParams.get("types") ?? "")
    .split(",")
    .filter((t): t is EntityType => ALLOWED.has(t as EntityType));
  // Favourites: cultural taste signals only (no albums/people duplicates, no venues).
  const results = await searchEntities(q.slice(0, 80), types.length ? types : FAVOURITE_TYPES, 8);
  return Response.json(results);
}
