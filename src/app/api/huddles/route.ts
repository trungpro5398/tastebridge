import { createHuddle } from "@/lib/store";
import { allow, ipHash, tooMany } from "@/lib/usage";
import { CreateHuddle } from "../schemas";

export async function POST(request: Request) {
  if (!allow(`create:${ipHash(request)}`, 30, 3_600_000)) return tooMany("new huddles");
  const parsed = CreateHuddle.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const huddle = await createHuddle(parsed.data);
  return Response.json({ id: huddle.id }, { status: 201 });
}
