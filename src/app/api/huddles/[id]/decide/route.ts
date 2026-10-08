import { agentEnabled, decide } from "@/lib/agent";
import { ConstraintError, type Step } from "@/lib/decide";
import { QlooError, withQlooLog } from "@/lib/qloo";
import { getHuddle, saveDecision } from "@/lib/store";
import type { Decision, Huddle } from "@/lib/types";
import { ipHash, reserveAgentRun } from "@/lib/usage";

export const maxDuration = 120;

type Failure = { error: string; status: number };

async function run(huddle: Huddle, request: Request, onStep?: (s: Step) => void): Promise<Decision | Failure> {
  let allowAgent = agentEnabled();
  let skipReason: string | undefined;
  if (allowAgent) {
    const budget = await reserveAgentRun(ipHash(request));
    allowAgent = budget.ok;
    skipReason = budget.reason;
  }
  try {
    const { result, calls } = await withQlooLog(() => decide(huddle, { onStep, allowAgent, skipReason }));
    if (!result.ranked.length) return { error: "No candidates matched. Try fewer constraints.", status: 422 };
    const decision = { ...result, qloo_calls: calls };
    await saveDecision(huddle.id, decision);
    return decision;
  } catch (err) {
    if (err instanceof ConstraintError) return { error: err.message, status: 422 };
    if (err instanceof QlooError) {
      console.error("[decide]", err.message);
      return { error: "The taste service is busy. Please try again in a minute.", status: 502 };
    }
    console.error("[decide] unexpected", err);
    return { error: "Something went wrong while deciding. Please try again.", status: 500 };
  }
}

/**
 * POST { force?: boolean }
 * - Reuses the saved decision while the group is unchanged (joins clear it) unless force is set.
 * - With `Accept: application/x-ndjson`, streams {type:"step"} lines while the agent works,
 *   then one {type:"result"} or {type:"error"} line.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/huddles/[id]/decide">) {
  const { id } = await ctx.params;
  const huddle = await getHuddle(id);
  if (!huddle) return Response.json({ error: "Huddle not found" }, { status: 404 });
  if (huddle.members.length < 2)
    return Response.json({ error: "Need at least 2 people to make a group decision" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { force?: unknown };
  const stream = request.headers.get("accept")?.includes("application/x-ndjson");

  if (huddle.result && body.force !== true) {
    if (!stream) return Response.json(huddle.result);
    return new Response(JSON.stringify({ type: "result", decision: huddle.result, cached: true }) + "\n", {
      headers: { "content-type": "application/x-ndjson" },
    });
  }

  if (!stream) {
    const out = await run(huddle, request);
    return "error" in out ? Response.json({ error: out.error }, { status: out.status }) : Response.json(out);
  }

  const enc = new TextEncoder();
  const body$ = new ReadableStream({
    async start(controller) {
      const send = (v: unknown) => controller.enqueue(enc.encode(JSON.stringify(v) + "\n"));
      const out = await run(huddle, request, (step) => send({ type: "step", ...step }));
      send("error" in out ? { type: "error", ...out } : { type: "result", decision: out });
      controller.close();
    },
  });
  return new Response(body$, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
