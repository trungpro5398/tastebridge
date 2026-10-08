import { getHuddle } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/huddles/[id]">) {
  const { id } = await ctx.params;
  const huddle = await getHuddle(id);
  if (!huddle) return Response.json({ error: "Huddle not found" }, { status: 404 });
  return Response.json(huddle);
}
