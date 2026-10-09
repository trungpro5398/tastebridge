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
  assert.deepEqual([c.closest?.a, c.closest?.b], ["B", "C"]);
  assert.equal(c.furthest, undefined);
  // A and D move in lockstep (r = 1) but barely care; the score follows B vs C (r = -1)
  assert.ok(c.score < 0.3);
});
