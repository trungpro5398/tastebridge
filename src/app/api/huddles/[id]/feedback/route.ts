import * as z from "zod";
import { addFeedback, getHuddle } from "@/lib/store";

const Body = z.union([
  z.object({ question: z.enum(["worked", "clear", "went"]), answer: z.enum(["yes", "no"]) }),
  z.object({ vote: z.enum(["up", "down"]) }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/huddles/[id]/feedback">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { question, answer }" }, { status: 400 });
  if (!(await getHuddle(id))) return Response.json({ error: "Huddle not found" }, { status: 404 });
  const { question, answer } =
    "vote" in parsed.data
      ? { question: "worked" as const, answer: parsed.data.vote === "up" ? ("yes" as const) : ("no" as const) }
      : parsed.data;
  await addFeedback(id, question, answer);
  return Response.json({ ok: true });
}
