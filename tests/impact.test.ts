import assert from "node:assert/strict";
import test from "node:test";
import { computeImpact, type Row } from "../src/lib/impact";

const cand = (id: string, min: number, mean: number) => ({
  entity: { entity_id: id, name: id, type: "x", affinity: 0, explain: {} },
  scores: [],
  min_satisfaction: min,
  mean_satisfaction: mean,
  nash: 0,
});

test("impact counts only real groups and measures the fair-vs-average trade", () => {
  const decision = (fair: [number, number], avg: [number, number] | null, refined = false) => ({
    ranked: [cand("fair", ...fair)],
    majority: avg ? cand("avg", ...avg) : cand("fair", ...fair),
    refinements: refined ? ["no sushi"] : undefined,
  });
  const rows = [
    { kind: "place", is_demo: false, result: decision([0.7, 0.8], [0.5, 0.9], true), feedback: [{ vote: "up", at: "" }], members: [{ count: 4 }], answers: [{ q: "clear", a: "no" }] },
    { kind: "movie", is_demo: false, result: decision([0.6, 0.7], null), feedback: null, members: [{ count: 3 }], answers: [{ q: "worked", a: "no" }, { q: "went", a: "yes" }] },
    { kind: "place", is_demo: false, result: null, feedback: null, members: [{ count: 1 }], answers: [] },
    { kind: "place", is_demo: true, result: decision([0.9, 0.9], [0.1, 0.95]), feedback: null, members: [{ count: 4 }], answers: [{ q: "worked", a: "yes" }] },
  ] as unknown as Row[];
  const s = computeImpact(rows);
  assert.equal(s.groups, 3);
  assert.equal(s.people, 8);
  assert.equal(s.decisions, 2);
  assert.equal(s.differs, 1);
  assert.ok(Math.abs(s.liftWhenDiffers! - 0.2) < 1e-9);
  assert.ok(Math.abs(s.costWhenDiffers! - 0.1) < 1e-9);
  assert.equal(s.refinedDecisions, 1);
  assert.deepEqual(s.worked, { yes: 1, n: 2 });
  assert.deepEqual(s.clear, { yes: 0, n: 1 });
  assert.deepEqual(s.went, { yes: 1, n: 1 });
  assert.equal(s.demoGroups, 1);
});
