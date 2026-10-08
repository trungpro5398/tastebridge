import * as z from "zod";
import { addFeedback, getHuddle } from "@/lib/store";

const Body = z.object({ vote: z.enum(["up", "down"]) });

export async function POST(request: Request, ctx: RouteContext<"/api/huddles/[id]/feedback">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "vote must be up or down" }, { status: 400 });
  if (!(await getHuddle(id))) return Response.json({ error: "Huddle not found" }, { status: 404 });
  await addFeedback(id, parsed.data.vote);
  return Response.json({ ok: true });
}
