import { after } from "next/server";
import { agentEnabled, decide } from "@/lib/agent";
import { ConstraintError, type RefineContext, type Step } from "@/lib/decide";
import { QlooError, withQlooLog } from "@/lib/qloo";
import { carriedOver } from "@/lib/fairness";
import { getHistory, getHuddle, getPrivateAvoids, isDeciding, saveDecision, setDeciding } from "@/lib/store";
import type { Decision, Huddle } from "@/lib/types";
import { ipHash, reserveAgentRun } from "@/lib/usage";

export const maxDuration = 120;

type Failure = { error: string; status: number };

async function run(
  huddle: Huddle,
  request: Request,
  onStep?: (s: Step) => void,
  ctx: RefineContext = {},
): Promise<Decision | Failure> {
  let allowAgent = agentEnabled();
  let skipReason: string | undefined;
  if (allowAgent) {
    const budget = await reserveAgentRun(ipHash(request));
    allowAgent = budget.ok;
    skipReason = budget.reason;
  }
  try {
    const { result, calls } = await withQlooLog(() => decide(huddle, { onStep, allowAgent, skipReason, ...ctx }));
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
  // private "not tonight" requests are attached server-side only; the result never says who asked
  const avoids = await getPrivateAvoids(id);
  huddle.members = huddle.members.map((m) => (avoids[m.id] ? { ...m, avoid: avoids[m.id] } : m));
  // fairness carries over: who gave way on this group's earlier outings
  if (huddle.parent_id) huddle.carried = carriedOver(await getHistory(huddle.parent_id));

  const body = (await request.json().catch(() => ({}))) as { force?: unknown; refine?: unknown };
  const refine = typeof body.refine === "string" ? body.refine.trim().slice(0, 160) : "";
  // A follow-up request ("somewhere quieter") re-plans from the current pick and keeps earlier requests.
  const prev = huddle.result;
  const prevTop = prev?.picks[0] && prev.ranked.find((r) => r.entity.entity_id === prev.picks[0].entity_id);
  const refineCtx: RefineContext = refine
    ? {
        refinements: [...(prev?.refinements ?? []), refine].slice(-4),
        previous: prevTop ? { entity_id: prevTop.entity.entity_id, name: prevTop.entity.name } : undefined,
      }
    : {};
  const stream = request.headers.get("accept")?.includes("application/x-ndjson");

  if (huddle.result && body.force !== true && !refine) {
    if (!stream) return Response.json(huddle.result);
    return new Response(JSON.stringify({ type: "result", decision: huddle.result, cached: true }) + "\n", {
      headers: { "content-type": "application/x-ndjson" },
    });
  }

  if (await isDeciding(id))
    return Response.json(
      { error: "Someone in your group is already finding the pick. It will appear here in a few seconds.", deciding: true },
      { status: 409 },
    );
  await setDeciding(id, true);

  if (!stream) {
    const out = await run(huddle, request, undefined, refineCtx).finally(() => setDeciding(id, false));
    return "error" in out ? Response.json({ error: out.error }, { status: out.status }) : Response.json(out);
  }

  const enc = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  let open = true;
  const body$ = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller;
    },
    cancel() {
      open = false; // viewer left; the work below still finishes and saves
    },
  });
  const send = (v: unknown) => {
    if (!open) return;
    try {
      ctrl.enqueue(enc.encode(JSON.stringify(v) + "\n"));
    } catch {
      open = false;
    }
  };
  const work = run(huddle, request, (step) => send({ type: "step", ...step }), refineCtx)
    .finally(() => setDeciding(id, false))
    .then((out) => {
      send("error" in out ? { type: "error", ...out } : { type: "result", decision: out });
      if (open) ctrl.close();
    });
  // Keep the function alive until the decision is saved, even if the viewer reloads.
  after(() => work);
  return new Response(body$, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
