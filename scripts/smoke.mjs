import assert from "node:assert/strict";

const base = process.env.BASE_URL ?? "http://localhost:3456";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("Smoke checks create fixtures; use a local server.");
}
async function request(path, body, expected = 200) {
  const response = await fetch(`${base}${path}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
  return data;
}

await request("/api/huddles", { title: "", kind: "place" }, 400);
await request("/api/huddles/missing", undefined, 404);
const favourites = await Promise.all(["Spirited Away", "John Wick"].map(async (q) => {
  const rows = await request(`/api/search?q=${encodeURIComponent(q)}`);
  assert.ok(rows.length);
  return rows[0];
}));
for (const kind of ["place", "movie", "tv_show"]) {
  const { id } = await request("/api/huddles", {
    title: `Smoke ${kind}`, kind, location: "Melbourne", notes: kind === "place" ? "vegetarian, under $$" : "",
  }, 201);
  await request(`/api/huddles/${id}/decide`, {}, 400);
  await request(`/api/huddles/${id}/members`, { name: "Duplicate", picks: [favourites[0], favourites[0]] }, 400);
  for (let i = 0; i < 2; i++) {
    await request(`/api/huddles/${id}/members`, { name: `Friend ${i}`, picks: [favourites[i]] }, 201);
  }
  const result = await request(`/api/huddles/${id}/decide`, {});
  assert.ok(result.picks.length);
  assert.equal(result.picks[0].entity_id, result.ranked[0].entity.entity_id);
  assert.ok(result.ranked.every((r) => r.scores.length === 2));
  const saved = await request(`/api/huddles/${id}`);
  assert.deepEqual(saved.result, result);
  await request(`/api/huddles/${id}/members`, { name: "New friend", picks: [favourites[0]] }, 201);
  assert.equal((await request(`/api/huddles/${id}`)).result, null);
  console.log(`PASS ${kind}: create, join, decide, persist, invalidate on join`);
}
const { id } = await request("/api/demo", {}, 201);
assert.equal((await request(`/api/huddles/${id}`)).members.length, 4);
const decision = await request(`/api/huddles/${id}/decide`, {});
console.log(JSON.stringify({ demo: `${base}/h/${id}`, mode: decision.mode,
  fair: decision.ranked[0].entity.name, minimum: decision.ranked[0].min_satisfaction,
  averagePick: decision.majority.entity.name, averageMinimum: decision.majority.min_satisfaction }, null, 2));
