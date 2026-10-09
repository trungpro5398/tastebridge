import { removeMember } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Leave a huddle (or remove your entry to edit it). Requires the secret edit token returned only at join. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/huddles/[id]/members/[memberId]">) {
  const { id, memberId } = await ctx.params;
  const token = request.headers.get("x-edit-token") ?? "";
  if (!UUID.test(memberId) || !UUID.test(token)) return Response.json({ error: "Unknown member" }, { status: 404 });
  const ok = await removeMember(id, memberId, token);
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: "Unknown member" }, { status: 404 });
}
