import assert from "node:assert/strict";
import test from "node:test";
import { allow } from "../src/lib/usage";

test("sliding-window limiter allows up to the limit, then blocks per key", () => {
  for (let i = 0; i < 3; i++) assert.equal(allow("t:a", 3, 60_000), true);
  assert.equal(allow("t:a", 3, 60_000), false);
  assert.equal(allow("t:b", 3, 60_000), true, "other keys are independent");
});
