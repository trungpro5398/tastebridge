import type { Entity } from "./types";

/** Qloo tag families worth showing people, most useful first. Noise (age ranges, payments…) is skipped. */
const PREFERRED = [
  "menu_highlight",
  "cuisine",
  "genre:place:restaurant",
  "culinary_style",
  "ambience",
  "beverage_offering",
  "decor",
  "genre:media",
  "genre",
  "keyword",
  "subgenre",
  "theme",
  "mock", // offline demo catalogue
];

const NOISE = /^(price level|restroom|seating|dine in|takeout|onsite services|table service|\d+\s+\d+)$/i;

/** Short, human "known for" tags for an entity (from Qloo's tag list). */
export function highlights(e: Pick<Entity, "tags">, n = 4): string[] {
  const out: string[] = [];
  const tags = e.tags ?? [];
  for (const family of PREFERRED) {
    for (const t of tags) {
      const fam = t.id.replace(/^urn:tag:/, "");
      if (!fam.startsWith(family + ":") && !fam.startsWith(family)) continue;
      if (NOISE.test(t.name) || out.some((o) => o.toLowerCase() === t.name.toLowerCase())) continue;
      out.push(t.name);
      if (out.length >= n) return out;
    }
  }
  return out;
}
