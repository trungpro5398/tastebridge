import * as z from "zod";

export const CreateHuddle = z.object({
  title: z.string().trim().min(1).max(80),
  kind: z.enum(["place", "movie", "tv_show"]),
  location: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
});

export const EntityIn = z.object({
  entity_id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  type: z.string().max(60),
  image: z.string().url().max(2000).optional(),
  meta: z.string().max(120).optional(),
  tags: z.array(z.object({ id: z.string().max(160), name: z.string().max(120) })).max(30).optional(),
});

export const JoinHuddle = z.object({
  name: z.string().trim().min(1).max(40),
  picks: z.array(EntityIn).min(1).max(3).refine(
    (picks) => new Set(picks.map((p) => p.entity_id)).size === picks.length,
    "Choose different favourites",
  ),
  /** private "not tonight" (e.g. "sushi", "horror"): applied as an exclusion, never shown with a name */
  avoid: z.string().trim().max(40).optional(),
});
