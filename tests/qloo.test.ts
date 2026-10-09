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
    return Response.json({ results: { tags: [
      { name: "United States", subtype: "urn:tag:region:qloo", query: { score: 0.99 } },
      { name: "Jazz", subtype: "urn:tag:genre:music", query: { score: 0.904 } },
    ] } });
  });
  assert.deepEqual(await compareTastes(["a"], ["b"], "urn:entity:movie"), [{ tag: "Jazz", score: 0.9 }]);
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

test("venue addresses shorten to the suburb", async () => {
  const { shortAddress } = await qloo;
  assert.equal(shortAddress("380 Brunswick St Fitzroy VIC 3065 Australia"), "Fitzroy");
  assert.equal(shortAddress("4 Princes Hwy Beaconsfield VIC 3807 Australia"), "Beaconsfield");
  assert.equal(shortAddress("797 Glenferrie Rd Hawthorn VIC 3122 Australia"), "Hawthorn");
  assert.equal(shortAddress("1 Main St, Springfield, IL 62701, USA"), "Springfield");
  assert.equal(shortAddress("8715 Melrose Ave West Hollywood, CA 90069"), "West Hollywood");
  assert.equal(shortAddress("1 Sky Garden Walk London EC3M 8AF United Kingdom"), "London");
  assert.equal(shortAddress("189 Grand St New York, NY 10013"), "New York");
  assert.equal(shortAddress("Evan Walker Bridge Southbank VIC 3006 Australia"), "Southbank");
  assert.equal(shortAddress(undefined), undefined);
});

test("dinner keeps restaurants, drops malls, markets, hotels and drink-first bars", async () => {
  const { isDiningVenue } = await qloo;
  const g = (x: string) => ({ primaryGenre: `urn:tag:genre:place:${x}` });
  assert.equal(isDiningVenue(g("restaurant")), true);
  assert.equal(isDiningVenue(g("restaurant:italian")), true);
  assert.equal(isDiningVenue(g("restaurant:vegan")), true);
  for (const x of ["shopping_mall", "market", "hotel", "restaurant:bar", "restaurant:cocktail_bar", "restaurant:lounge_bar", "restaurant:breakfast", "restaurant:cafe", "restaurant:coffee_shop", "restaurant:espresso_bar", "restaurant:beer_garden"])
    assert.equal(isDiningVenue(g(x)), false, x);
  assert.equal(isDiningVenue({}), true);
});

test("search hits must plausibly match what was typed", async () => {
  const { confidentMatch } = await qloo;
  assert.equal(confidentMatch("Teresa Teng", "Vienna Teng"), false);
  assert.equal(confidentMatch("xqzzvy nonexistent", "Mystery Lover Nonexistent Summer"), false);
  assert.equal(confidentMatch("MasterChef Australia", "MasterChef: Australia"), true);
  assert.equal(confidentMatch("Trinh Cong Son", "Trịnh Công Sơn"), true);
  assert.equal(confidentMatch("the godfather", "The Godfather"), true);
});
