import { addMember, getHuddle } from "@/lib/store";
import { JoinHuddle } from "../../../schemas";

export async function POST(request: Request, ctx: RouteContext<"/api/huddles/[id]/members">) {
  const { id } = await ctx.params;
  const huddle = await getHuddle(id);
  if (!huddle) return Response.json({ error: "Huddle not found" }, { status: 404 });
  if (huddle.members.length >= 8) return Response.json({ error: "This huddle is full (8 people)" }, { status: 409 });

  const parsed = JoinHuddle.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const member = await addMember(id, parsed.data.name, parsed.data.picks, parsed.data.avoid);
  return Response.json(member, { status: 201 });
}
