import { createHuddle } from "@/lib/store";
import { CreateHuddle } from "../schemas";

export async function POST(request: Request) {
  const parsed = CreateHuddle.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const huddle = await createHuddle(parsed.data);
  return Response.json({ id: huddle.id }, { status: 201 });
}
