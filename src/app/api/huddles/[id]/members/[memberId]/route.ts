import { removeMember } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Leave a huddle (or remove your entry to edit it). The member id is only known to that member's browser. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/huddles/[id]/members/[memberId]">) {
  const { id, memberId } = await ctx.params;
  if (!UUID.test(memberId)) return Response.json({ error: "Unknown member" }, { status: 404 });
  const ok = await removeMember(id, memberId);
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: "Unknown member" }, { status: 404 });
}
