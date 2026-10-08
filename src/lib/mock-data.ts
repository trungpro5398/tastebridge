/**
 * Offline catalogue used when QLOO_API_KEY is not set (local dev, judges without quota).
 * Venue names are fictional. No data in this file comes from the Qloo API.
 */
import type { Entity, EntityType } from "./types";

type Row = [id: string, name: string, type: EntityType, tags: string[], meta?: string];

const T = (s: string) => s.split(" ");

const rows: Row[] = [
  // ---- favourites people type in (cross-domain signals) ----
  ["mock-mv-01", "Spirited Away", "urn:entity:movie", T("animation fantasy family cozy japanese"), "2001"],
  ["mock-mv-02", "Inception", "urn:entity:movie", T("sci-fi thriller cerebral blockbuster"), "2010"],
  ["mock-mv-03", "La La Land", "urn:entity:movie", T("romance music feel-good nostalgic"), "2016"],
  ["mock-mv-04", "Parasite", "urn:entity:movie", T("thriller dark satire korean cerebral"), "2019"],
  ["mock-mv-05", "The Grand Budapest Hotel", "urn:entity:movie", T("comedy quirky cozy european"), "2014"],
  ["mock-mv-06", "Mad Max: Fury Road", "urn:entity:movie", T("action adventure blockbuster loud"), "2015"],
  ["mock-mv-07", "Everything Everywhere All at Once", "urn:entity:movie", T("sci-fi comedy family quirky"), "2022"],
  ["mock-mv-08", "Interstellar", "urn:entity:movie", T("sci-fi cerebral emotional blockbuster"), "2014"],
  ["mock-mv-09", "Amélie", "urn:entity:movie", T("romance quirky cozy european feel-good"), "2001"],
  ["mock-mv-10", "John Wick", "urn:entity:movie", T("action thriller loud late-night"), "2014"],
  ["mock-mv-11", "Paddington 2", "urn:entity:movie", T("family comedy feel-good cozy"), "2017"],
  ["mock-mv-12", "Dune", "urn:entity:movie", T("sci-fi adventure blockbuster epic"), "2021"],
  ["mock-mv-13", "Before Sunrise", "urn:entity:movie", T("romance talky european indie"), "1995"],
  ["mock-mv-14", "Knives Out", "urn:entity:movie", T("mystery comedy ensemble feel-good"), "2019"],
  ["mock-mv-15", "Your Name", "urn:entity:movie", T("animation romance japanese emotional"), "2016"],
  ["mock-mv-16", "Get Out", "urn:entity:movie", T("horror thriller satire dark"), "2017"],
  ["mock-mv-17", "Ratatouille", "urn:entity:movie", T("animation family foodie feel-good european"), "2007"],
  ["mock-mv-18", "The Social Network", "urn:entity:movie", T("drama talky cerebral tech"), "2010"],
  ["mock-mv-19", "Top Gun: Maverick", "urn:entity:movie", T("action blockbuster nostalgic loud"), "2022"],
  ["mock-mv-20", "Past Lives", "urn:entity:movie", T("romance indie korean emotional talky"), "2023"],
  ["mock-mv-21", "Chef", "urn:entity:movie", T("comedy foodie feel-good latin"), "2014"],
  ["mock-mv-22", "Arrival", "urn:entity:movie", T("sci-fi cerebral emotional quiet"), "2016"],
  ["mock-mv-23", "Crazy Rich Asians", "urn:entity:movie", T("romance comedy feel-good upscale"), "2018"],
  ["mock-mv-24", "The Menu", "urn:entity:movie", T("thriller satire foodie dark upscale"), "2022"],

  ["mock-tv-01", "The Bear", "urn:entity:tv_show", T("drama foodie intense loud"), "2022–"],
  ["mock-tv-02", "Ted Lasso", "urn:entity:tv_show", T("comedy feel-good sports cozy"), "2020–2023"],
  ["mock-tv-03", "Severance", "urn:entity:tv_show", T("sci-fi thriller cerebral dark"), "2022–"],
  ["mock-tv-04", "Bluey", "urn:entity:tv_show", T("animation family feel-good cozy"), "2018–"],
  ["mock-tv-05", "Squid Game", "urn:entity:tv_show", T("thriller dark korean intense"), "2021–"],
  ["mock-tv-06", "Only Murders in the Building", "urn:entity:tv_show", T("mystery comedy cozy ensemble"), "2021–"],
  ["mock-tv-07", "The Last of Us", "urn:entity:tv_show", T("drama adventure emotional dark"), "2023–"],
  ["mock-tv-08", "Abbott Elementary", "urn:entity:tv_show", T("comedy feel-good ensemble"), "2021–"],
  ["mock-tv-09", "Shōgun", "urn:entity:tv_show", T("drama epic japanese intense"), "2024–"],
  ["mock-tv-10", "Somebody Feed Phil", "urn:entity:tv_show", T("foodie travel feel-good documentary"), "2018–"],

  ["mock-ar-01", "Taylor Swift", "urn:entity:artist", T("pop feel-good romance nostalgic")],
  ["mock-ar-02", "Radiohead", "urn:entity:artist", T("indie cerebral dark quiet")],
  ["mock-ar-03", "Kendrick Lamar", "urn:entity:artist", T("hip-hop intense cerebral loud")],
  ["mock-ar-04", "Norah Jones", "urn:entity:artist", T("jazz cozy quiet romance")],
  ["mock-ar-05", "BTS", "urn:entity:artist", T("pop korean feel-good loud")],
  ["mock-ar-06", "Joe Hisaishi", "urn:entity:artist", T("soundtrack japanese emotional quiet")],
  ["mock-ar-07", "Daft Punk", "urn:entity:artist", T("electronic late-night loud nostalgic")],
  ["mock-ar-08", "Billie Eilish", "urn:entity:artist", T("pop dark quiet indie")],

  ["mock-bk-01", "Salt Fat Acid Heat", "urn:entity:book", T("foodie cozy")],
  ["mock-bk-02", "Project Hail Mary", "urn:entity:book", T("sci-fi adventure feel-good cerebral")],
  ["mock-bk-03", "Norwegian Wood", "urn:entity:book", T("romance japanese quiet emotional")],

  // ---- Melbourne venues (fictional) ----
  ["mock-pl-01", "Lantern & Lime", "urn:entity:place", T("vietnamese cheap-eats vegetarian-friendly cozy"), "Footscray · $"],
  ["mock-pl-02", "Osteria Nonna Rina", "urn:entity:place", T("italian cozy romance european family vegetarian-friendly"), "Carlton · $$"],
  ["mock-pl-03", "Neon Ramen Bar", "urn:entity:place", T("japanese late-night loud cheap-eats"), "CBD · $"],
  ["mock-pl-04", "The Green Fig", "urn:entity:place", T("vegetarian-friendly vegan cozy quiet"), "Fitzroy · $$"],
  ["mock-pl-05", "Smoke & Steel Grill", "urn:entity:place", T("bbq loud sports blockbuster"), "Richmond · $$"],
  ["mock-pl-06", "Seoul Garden Pocha", "urn:entity:place", T("korean late-night loud feel-good vegetarian-friendly"), "CBD · $$"],
  ["mock-pl-07", "Atelier Nineteen", "urn:entity:place", T("upscale foodie european quiet"), "Southbank · $$$$"],
  ["mock-pl-08", "Bluestone Jazz Kitchen", "urn:entity:place", T("jazz live-music cozy romance vegetarian-friendly"), "CBD · $$$"],
  ["mock-pl-09", "Taco Vecino", "urn:entity:place", T("latin cheap-eats feel-good loud vegetarian-friendly"), "Brunswick · $"],
  ["mock-pl-10", "Kintsugi Omakase", "urn:entity:place", T("japanese upscale quiet foodie"), "Collingwood · $$$$"],
  ["mock-pl-11", "Pixel Arcade Bar", "urn:entity:place", T("late-night nostalgic loud electronic"), "CBD · $$"],
  ["mock-pl-12", "Spice Route Dosa", "urn:entity:place", T("indian vegetarian-friendly cheap-eats family"), "Dandenong · $"],
  ["mock-pl-13", "Harbour Fish Co.", "urn:entity:place", T("seafood family feel-good"), "St Kilda · $$"],
  ["mock-pl-14", "Cinema Dumpling House", "urn:entity:place", T("chinese cheap-eats family late-night"), "CBD · $"],
  ["mock-pl-15", "Rooftop Sixty", "urn:entity:place", T("cocktails upscale electronic late-night"), "CBD · $$$"],
  ["mock-pl-16", "Little Kyoto Café", "urn:entity:place", T("japanese cozy quiet vegetarian-friendly animation"), "Carlton · $$"],
  ["mock-pl-17", "The Board Game Pantry", "urn:entity:place", T("cozy quirky family cheap-eats vegetarian-friendly"), "Brunswick · $"],
  ["mock-pl-18", "Mercado Rojo", "urn:entity:place", T("latin live-music loud feel-good vegetarian-friendly"), "Fitzroy · $$"],
];

export const MOCK_ENTITIES: Entity[] = rows.map(([entity_id, name, type, tags, meta]) => ({
  entity_id,
  name,
  type,
  meta,
  tags: tags.map((t) => ({ id: `urn:tag:mock:${t}`, name: t })),
}));

export const MOCK_BY_ID = new Map(MOCK_ENTITIES.map((e) => [e.entity_id, e]));
