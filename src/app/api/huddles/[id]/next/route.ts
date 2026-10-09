import { createNextHuddle, getHuddle } from "@/lib/store";
import { allow, ipHash, tooMany } from "@/lib/usage";

/** Plan the group's next outing: same people and favourites, and fairness carries over. */
export async function POST(request: Request, ctx: RouteContext<"/api/huddles/[id]/next">) {
  const { id } = await ctx.params;
  if (!allow(`next:${ipHash(request)}`, 20, 3_600_000)) return tooMany("new outings");
  const huddle = await getHuddle(id);
  if (!huddle) return Response.json({ error: "Huddle not found" }, { status: 404 });
  if (!huddle.result) return Response.json({ error: "Decide this outing first" }, { status: 409 });
  const next = await createNextHuddle(id);
  return next ? Response.json({ id: next }, { status: 201 }) : Response.json({ error: "Could not plan the next outing" }, { status: 500 });
}
