import assert from "node:assert/strict";
import test from "node:test";
import { percentiles, rankFairly } from "../src/lib/fairness";
import type { InsightEntity, Member } from "../src/lib/types";

test("percentiles preserve ties and input order", () => {
  assert.deepEqual(percentiles([9, 1, 5, 5]), [1, 0, 0.5, 0.5]);
  assert.deepEqual(percentiles([]), []);
  assert.deepEqual(percentiles([3]), [1]);
  assert.deepEqual(percentiles([2, 2, 2]), [0.5, 0.5, 0.5]);
});

const entity = (id: string, affinity = 0): InsightEntity => ({
  entity_id: id, name: id, type: "urn:entity:movie", affinity, explain: {},
});
const members: Member[] = ["a", "b", "c"].map((id) => ({ id, name: id, picks: [], joined_at: "" }));

test("maximin protects the minority even when the mean favours another option", () => {
  const shortlist = ["popular", "balanced", "other"].map((id) => entity(id));
  const perMember = {
    a: [entity("popular", 1), entity("balanced", 0.6), entity("other", 0.1)],
    b: [entity("popular", 1), entity("balanced", 0.6), entity("other", 0.1)],
    c: [entity("popular", 0.1), entity("balanced", 0.6), entity("other", 1)],
  };
  const result = rankFairly(shortlist, members, perMember);
  assert.equal(result.ranked[0].entity.entity_id, "balanced");
  assert.equal(result.ranked[0].min_satisfaction, 0.5);
  assert.equal(result.majority?.entity.entity_id, "popular");
  assert.equal(result.majority?.min_satisfaction, 0);
});

test("ranking is invariant to positive affine rescaling of one person's scores", () => {
  const shortlist = [entity("x"), entity("y"), entity("z")];
  const original = { a: shortlist.map((e, i) => ({ ...e, affinity: i / 2 })) };
  const scaled = { a: original.a.map((e) => ({ ...e, affinity: e.affinity * 100 + 50 })) };
  assert.deepEqual(
    rankFairly(shortlist, members.slice(0, 1), original).ranked.map((r) => r.scores[0].satisfaction),
    rankFairly(shortlist, members.slice(0, 1), scaled).ranked.map((r) => r.scores[0].satisfaction),
  );
});

test("empty group or shortlist has no winner", () => {
  assert.deepEqual(rankFairly([], members, {}), { ranked: [], majority: null });
  assert.deepEqual(rankFairly([entity("x")], [], {}), { ranked: [], majority: null });
});

test("highlights keep meaningful Qloo tags and drop noise", async () => {
  const { highlights } = await import("../src/lib/highlights");
  const tags = [
    { id: "urn:tag:age_range:qloo:25_29", name: "25 29" },
    { id: "urn:tag:ambience:qloo:family_friendly", name: "Family friendly" },
    { id: "urn:tag:payments:place:price_level", name: "Price level" },
    { id: "urn:tag:menu_highlight:qloo:mushroom_burger", name: "Mushroom burger" },
    { id: "urn:tag:cuisine:qloo:global_fusion", name: "Global fusion" },
  ];
  assert.deepEqual(highlights({ tags }), ["Mushroom burger", "Global fusion", "Family friendly"]);
});

test("group compatibility finds taste twins and the furthest-apart pair", async () => {
  const { groupCompatibility } = await import("../src/lib/fairness");
  const mk = (sats: number[]) => sats.map((v, i) => ({ member_id: `m${i}`, member_name: ["A", "B", "C"][i], affinity: v, satisfaction: v, because: [] }));
  const ranked = [
    [1, 0.9, 0], [0.75, 0.8, 0.25], [0.5, 0.5, 0.5], [0.25, 0.3, 0.75], [0, 0.1, 1],
  ].map((sats, i) => ({ entity: { entity_id: `e${i}`, name: `E${i}`, type: "x", affinity: 0, explain: {} }, scores: mk(sats), min_satisfaction: 0, mean_satisfaction: 0, nash: 0 }));
  const c = groupCompatibility(ranked)!;
  assert.deepEqual([c.closest?.a, c.closest?.b], ["A", "B"]);
  assert.ok(c.furthest && [c.furthest.a, c.furthest.b].includes("C"));
  assert.ok(c.score < 0.5);
});

test("time zone picks a sensible default city and streaming region", async () => {
  const { guessCity, watchRegion } = await import("../src/lib/locale");
  assert.equal(guessCity("America/New_York"), "New York");
  assert.equal(guessCity("Australia/Melbourne"), "Melbourne");
  assert.equal(guessCity("Mars/Olympus"), "Melbourne");
  assert.equal(watchRegion("America/Los_Angeles"), "us");
  assert.equal(watchRegion("Europe/London"), "uk");
  assert.equal(watchRegion("Australia/Sydney"), "au");
});

test("a flexible person (tiny Qloo spread) cannot drive the decision; a decisive one is protected", () => {
  const shortlist = ["x", "y", "z"].map((id) => entity(id));
  const perMember = {
    // a: nearly flat scores, noise-level differences
    a: [entity("x", 0.6), entity("y", 0.601), entity("z", 0.602)],
    // b and c: clear, opposite preferences between x and z, both fine with y
    b: [entity("x", 0.9), entity("y", 0.7), entity("z", 0.2)],
    c: [entity("x", 0.2), entity("y", 0.7), entity("z", 0.9)],
  };
  const r = rankFairly(shortlist, members, perMember);
  const a = r.ranked[0].scores.find((s) => s.member_id === "a")!;
  assert.equal(a.flexible, true);
  assert.ok(Math.abs(a.satisfaction - 0.5) < 0.02, "flexible person sits near neutral");
  assert.equal(r.ranked[0].entity.entity_id, "y");
});

test("drivers only name favourites that clearly stand out", async () => {
  const { drivers } = await import("../src/lib/fairness");
  const names = new Map([["f1", "Amélie"], ["f2", "Norah Jones"], ["f3", "Spirited Away"]]);
  assert.deepEqual(drivers({ f1: 0.34, f2: 0.33, f3: 0.33 }, names), []);
  assert.deepEqual(drivers({ f1: 0.6, f2: 0.2, f3: 0.2 }, names).map((d) => d.name), ["Amélie"]);
});

test("compatibility never names flexible people as taste twins", async () => {
  const { groupCompatibility } = await import("../src/lib/fairness");
  const flex = [true, false, false, true];
  const mk = (sats: number[]) =>
    sats.map((v, i) => ({ member_id: `m${i}`, member_name: "ABCD"[i], affinity: v, satisfaction: v, decisiveness: flex[i] ? 0.2 : 1, flexible: flex[i], because: [] }));
  const ranked = [
    [0.5, 1, 0, 0.5], [0.52, 0.75, 0.25, 0.52], [0.49, 0.5, 0.5, 0.49], [0.51, 0.25, 0.75, 0.51], [0.48, 0, 1, 0.48],
  ].map((sats, i) => ({ entity: { entity_id: `e${i}`, name: `E${i}`, type: "x", affinity: 0, explain: {} }, scores: mk(sats), min_satisfaction: 0, mean_satisfaction: 0, nash: 0 }));
  const c = groupCompatibility(ranked)!;
  // the only pair who care disagree completely: "furthest apart", never "taste twins"
  assert.equal(c.closest, undefined);
  assert.deepEqual([c.furthest?.a, c.furthest?.b], ["B", "C"]);
  // A and D move in lockstep (r = 1) but barely care; the score follows B vs C (r = -1)
  assert.ok(c.score < 0.3);
});

test("indifferent people cannot overrule the people who care", () => {
  const four: Member[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id, picks: [], joined_at: "" }));
  const shortlist = ["soup", "santucci", "other"].map((id) => entity(id));
  const perMember = {
    // a and b care, and both clearly prefer soup
    a: [entity("soup", 0.9), entity("santucci", 0.6), entity("other", 0.3)],
    b: [entity("soup", 0.85), entity("santucci", 0.55), entity("other", 0.3)],
    // c and d barely care, and lean very slightly the other way
    c: [entity("soup", 0.6), entity("santucci", 0.605), entity("other", 0.61)],
    d: [entity("soup", 0.6), entity("santucci", 0.605), entity("other", 0.601)],
  };
  const r = rankFairly(shortlist, four, perMember);
  assert.equal(r.ranked[0].entity.entity_id, "soup");
  const soup = r.ranked[0];
  assert.ok(soup.scores.filter((s) => s.flexible).map((s) => s.member_id).join() === "c,d");
  // the floor is about a and b; the true minimum (a flexible person) is reported separately
  assert.ok(soup.min_satisfaction >= 0.99);
  assert.ok((soup.min_all ?? 1) < soup.min_satisfaction);
});

test("a one-point gain for people who care can't push a flexible person far down", async () => {
  const { fairOrder } = await import("../src/lib/fairness");
  const opt = (id: string, floor: number, all: number) => ({
    entity: entity(id), scores: [], min_satisfaction: floor, min_all: all, mean_satisfaction: 0.5, nash: 0,
  });
  // ima: carers' floor 58, but a flexible teen at 28; moat: floor 57, everyone at 57 or more
  assert.equal(fairOrder([opt("ima", 0.58, 0.28), opt("moat", 0.57, 0.57)])[0].entity.entity_id, "moat");
  // a real gain for someone who cares still wins
  assert.equal(fairOrder([opt("soup", 0.74, 0.43), opt("santucci", 0.52, 0.49)])[0].entity.entity_id, "soup");
});

test("someone who gave way last time gets a capped credit that can tip a close call", async () => {
  const { carriedOver, rankFairly } = await import("../src/lib/fairness");
  const sc = (id: string, sat: number) => ({ member_id: id, member_name: id.toUpperCase(), affinity: 0, satisfaction: sat, because: [] });
  const prev = {
    result: {
      picks: [{ entity_id: "old" }],
      ranked: [{ entity: entity("old"), scores: [sc("a", 0.8), sc("b", 0.3)], min_satisfaction: 0.3, mean_satisfaction: 0, nash: 0 }],
    },
  } as never;
  const carried = carriedOver([prev]);
  assert.deepEqual(carried.map((c) => c.member_name), ["B"]);
  assert.ok(carried[0].credit > 0 && carried[0].credit <= 0.15);
  // tonight: x suits a a little more, y suits b a little more; without history x wins, with b's credit y wins
  const shortlist = ["x", "y", "z"].map((id) => entity(id));
  const two: Member[] = ["a", "b"].map((id) => ({ id, name: id.toUpperCase(), picks: [], joined_at: "" }));
  const perMember = {
    a: [entity("x", 0.9), entity("y", 0.6), entity("z", 0.1)],
    b: [entity("x", 0.6), entity("y", 0.9), entity("z", 0.1)],
  };
  const plain = rankFairly(shortlist, two, perMember).ranked[0].entity.entity_id;
  const leaning = rankFairly(shortlist, two, perMember, { b: carried[0].credit }).ranked[0].entity.entity_id;
  assert.equal(leaning, "y");
  assert.ok(plain === "x" || plain === "y");
});

test("a carried-over credit can't override kindness to everyone", async () => {
  const { fairOrder } = await import("../src/lib/fairness");
  const opt = (id: string, floor: number, debt: number, all: number) => ({
    entity: entity(id), scores: [], min_satisfaction: floor, debt_floor: debt, min_all: all, mean_satisfaction: 0.5, nash: 0,
  });
  // the next-outing case: credit lowers moat's floor, but moat is far kinder to the flexible teen
  const order = fairOrder([opt("ima", 0.579, 0.579, 0.28), opt("moat", 0.566, 0.524, 0.566)]);
  assert.equal(order[0].entity.entity_id, "moat");
});

test("between equally kind options, a carried-over credit really breaks the close call", async () => {
  const { fairOrder } = await import("../src/lib/fairness");
  const opt = (id: string, floor: number, debt: number, all: number) => ({
    entity: entity(id), scores: [], min_satisfaction: floor, debt_floor: debt, min_all: all, mean_satisfaction: 0.5, nash: 0,
  });
  // without history x wins (60 vs 58); x is where the person who gave way is lowest, so with credit y wins
  assert.equal(fairOrder([opt("x", 0.6, 0.6, 0.6), opt("y", 0.58, 0.58, 0.58)])[0].entity.entity_id, "x");
  assert.equal(fairOrder([opt("x", 0.6, 0.55, 0.6), opt("y", 0.58, 0.58, 0.58)])[0].entity.entity_id, "y");
});
