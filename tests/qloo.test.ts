import assert from "node:assert/strict";
import test from "node:test";

process.env.QLOO_API_KEY = "test-fixture-only";
const qloo = import("../src/lib/qloo");

test("live insights sends shared shortlist, intersection tags and explainability", async (t) => {
  const { insights } = await qloo;
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/v2/insights");
    assert.equal(url.searchParams.get("filter.results.entities"), "candidate");
    assert.equal(url.searchParams.get("operator.filter.tags"), "intersection");
    assert.equal(url.searchParams.get("feature.explainability"), "true");
    assert.equal(url.searchParams.get("filter.price_level.max"), "2");
    assert.equal((init.headers as Record<string, string>)["X-Api-Key"], "test-fixture-only");
    return Response.json({ results: { entities: [{
      entity_id: "candidate", name: "Fixture", subtype: "urn:entity:place",
      query: { affinity: 0.7, explainability: { entities: [{ entity_id: "favourite", score: 0.8 }] } },
    }] } });
  });
  const [entity] = await insights({ type: "urn:entity:place", signal: ["favourite"], candidates: ["candidate"], tags: ["diet"], priceMax: 2 });
  assert.equal(entity.affinity, 0.7);
  assert.deepEqual(entity.explain, { favourite: 0.8 });
});

test("comparison uses the documented analysis endpoint and both signals", async (t) => {
  const { compareTastes } = await qloo;
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/v2/analysis/compare");
    assert.equal(url.searchParams.get("a.signal.interests.entities"), "a");
    assert.equal(url.searchParams.get("b.signal.interests.entities"), "b");
    return Response.json({ results: { fixture: true } });
  });
  assert.deepEqual(await compareTastes(["a"], ["b"], "urn:entity:movie"), { fixture: true });
});

test("network failures become a handled Qloo error", async (t) => {
  const { insights, QlooError } = await qloo;
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("network down"); });
  await assert.rejects(insights({ type: "urn:entity:movie", signal: ["uncached"] }), QlooError);
});

test("provenance log records each request with entity ids redacted and no key", async (t) => {
  const { insights, withQlooLog } = await qloo;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ results: { entities: [{ entity_id: "c1", name: "One", query: { affinity: 0.5 } }] } }),
  );
  const { calls } = await withQlooLog(() =>
    insights({ type: "urn:entity:movie", signal: ["secret-a", "secret-b"], candidates: ["c1"], take: 7 }),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, "/v2/insights");
  assert.equal(calls[0].source, "qloo");
  assert.equal(calls[0].results, 1);
  assert.equal(calls[0].params["signal.interests.entities"], "2 entity id(s)");
  assert.equal(calls[0].params["filter.type"], "urn:entity:movie");
  const dump = JSON.stringify(calls);
  assert.ok(!dump.includes("secret-a") && !dump.includes("test-fixture-only"));
});
