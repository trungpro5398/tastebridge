import assert from "node:assert/strict";
import test from "node:test";
import { DecisionSession, decideWithRules, parsePrice } from "../src/lib/decide";
import { MOCK_ENTITIES } from "../src/lib/mock-data";
import { JoinHuddle } from "../src/app/api/schemas";
import type { Huddle } from "../src/lib/types";

function huddle(notes = "One vegetarian, under $$$"): Huddle {
  return {
    id: "test", title: "Dinner", kind: "place", location: "Melbourne", notes, created_at: "",
    members: ["Spirited Away", "John Wick"].map((name, i) => ({
      id: String(i), name: `Friend ${i}`, joined_at: "",
      picks: [MOCK_ENTITIES.find((e) => e.name === name)!],
    })),
  };
}

test("rules fallback applies vegetarian and budget requirements", async () => {
  const result = await decideWithRules(huddle());
  assert.ok(result.ranked.length > 0);
  for (const r of result.ranked) {
    assert.ok(r.entity.tags?.some((t) => t.name === "vegetarian-friendly"));
    assert.ok((r.entity.meta?.match(/\$+/)?.[0].length ?? 0) <= 2);
  }
  assert.deepEqual(result.picks.map((p) => p.entity_id), result.ranked.slice(0, 3).map((r) => r.entity.entity_id));
});

test("agent retries cannot relax the required budget or diet", async () => {
  const session = new DecisionSession(huddle());
  await session.generateCandidates({ priceMax: 4, tags: [] });
  assert.equal(session.filters.price_level_max, 2);
  assert.match(String(session.filters.tags), /vegetarian-friendly/);
});

test("no matching candidates returns an empty result without throwing", async () => {
  const session = new DecisionSession(huddle());
  await session.generateCandidates({ tags: ["urn:tag:mock:nonexistent"] });
  assert.deepEqual(await session.scoreMembers(), { ranked: [], majority: null });
  assert.equal(session.toDecision("rules").picks.length, 0);
});

test("unknown required diet cannot silently become an unfiltered recommendation", async () => {
  await assert.rejects(decideWithRules(huddle("gluten-free")), /Could not verify/);
});

test("finalize rejects reordered, duplicate and unknown picks", async () => {
  const session = new DecisionSession(huddle(""));
  await session.generateCandidates();
  await session.scoreMembers();
  const picks = session.toDecision("rules").picks;
  assert.match(session.finalize([...picks].reverse(), "wrong"), /^error/);
  assert.match(session.finalize([picks[0], picks[0], picks[0]], "wrong"), /^error/);
  assert.match(session.finalize([{ ...picks[0], entity_id: "unknown" }], "wrong"), /^error/);
  assert.equal(session.picks, null);
  assert.equal(session.finalize(picks, "correct"), "saved");
  await session.generateCandidates();
  assert.equal(session.picks, null);
  assert.equal(session.majority, null);
  assert.equal(session.tradeoffNote, "");
});

test("comparison reports shortlist evidence in mock mode", async () => {
  const session = new DecisionSession(huddle(""));
  await session.generateCandidates();
  await session.scoreMembers();
  const comparison = await session.compareMembers("Friend 0", "Friend 1");
  assert.ok("biggest_disagreements" in comparison);
  assert.equal("qloo_analysis" in comparison && comparison.qloo_analysis, null);
});

test("joining rejects duplicate favourites and more than three picks", () => {
  const pick = huddle().members[0].picks[0];
  assert.equal(JoinHuddle.safeParse({ name: "A", picks: [pick, pick] }).success, false);
  assert.equal(JoinHuddle.safeParse({ name: "A", picks: MOCK_ENTITIES.slice(0, 4) }).success, false);
});

test("budget phrases: 'under' excludes the named level, 'max'/'up to' include it", () => {
  assert.equal(parsePrice("Keep it under $$$"), 2);
  assert.equal(parsePrice("under $"), 1);
  assert.equal(parsePrice("max $$"), 2);
  assert.equal(parsePrice("up to $$$"), 3);
  assert.equal(parsePrice("no budget"), undefined);
});

test("fair pick never leaves its least-matched member worse off than the mean-score baseline", async () => {
  for (const notes of ["", "Keep it under $$$.", "Priya is vegetarian."]) {
    const result = await decideWithRules(huddle(notes));
    assert.ok(result.majority);
    assert.ok(result.ranked[0].min_satisfaction >= result.majority.min_satisfaction, notes);
  }
});
