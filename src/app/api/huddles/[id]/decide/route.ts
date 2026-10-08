import { decide } from "@/lib/agent";
import { QlooError } from "@/lib/qloo";
import { getHuddle, saveDecision } from "@/lib/store";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: RouteContext<"/api/huddles/[id]/decide">) {
  const { id } = await ctx.params;
  const huddle = await getHuddle(id);
  if (!huddle) return Response.json({ error: "Huddle not found" }, { status: 404 });
  if (huddle.members.length < 2)
    return Response.json({ error: "Need at least 2 people to make a group decision" }, { status: 400 });

  try {
    const result = await decide(huddle);
    if (!result.ranked.length)
      return Response.json({ error: "No candidates matched. Try fewer constraints." }, { status: 422 });
    await saveDecision(id, result);
    return Response.json(result);
  } catch (err) {
    if (err instanceof QlooError) {
      console.error("[decide]", err.message);
      return Response.json({ error: "The taste service is busy. Please try again in a minute." }, { status: 502 });
    }
    throw err;
  }
}
