import { searchEntities } from "@/lib/qloo";
import { addMember, createHuddle } from "@/lib/store";
import type { Entity } from "@/lib/types";

/** One-click demo huddle for judges: four friends with clashing tastes. */
const FRIENDS: { name: string; favourites: string[] }[] = [
  { name: "Mai", favourites: ["Spirited Away", "Norah Jones", "Amélie"] },
  { name: "Josh", favourites: ["Mad Max: Fury Road", "John Wick", "Daft Punk"] },
  { name: "Priya", favourites: ["Ratatouille", "The Bear", "Salt Fat Acid Heat"] },
  { name: "Leo", favourites: ["Parasite", "Severance", "Radiohead"] },
];

export async function POST() {
  const huddle = await createHuddle({
    title: "Friday dinner",
    kind: "place",
    location: "Melbourne",
    notes: "Keep it under $$$.",
  });
  for (const f of FRIENDS) {
    const picks = (await Promise.all(f.favourites.map((n) => searchEntities(n, undefined, 1).then((r) => r[0]))))
      .filter((e): e is Entity => !!e);
    if (picks.length) await addMember(huddle.id, f.name, picks);
  }
  return Response.json({ id: huddle.id }, { status: 201 });
}
