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
