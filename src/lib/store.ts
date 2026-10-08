/**
 * Persistence. Uses Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
 * (schema: supabase/schema.sql), otherwise an in-process memory store for local dev.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Decision, Entity, Huddle, HuddleKind, Member } from "./types";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb: SupabaseClient | null = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false } }) : null;
export const supabase = sb;

const g = globalThis as unknown as { __huddles?: Map<string, Huddle> };
const mem = (g.__huddles ??= new Map());

export function newHuddleId() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function createHuddle(input: {
  title: string;
  kind: HuddleKind;
  location?: string;
  notes?: string;
}): Promise<Huddle> {
  const h: Huddle = { id: newHuddleId(), created_at: new Date().toISOString(), members: [], result: null, ...input };
  if (!sb) {
    mem.set(h.id, h);
    return h;
  }
  const { error } = await sb.from("huddles").insert({
    id: h.id,
    title: h.title,
    kind: h.kind,
    location: h.location ?? null,
    notes: h.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return h;
}

export async function getHuddle(id: string): Promise<Huddle | null> {
  if (!sb) return mem.get(id) ?? null;
  const { data, error } = await sb.from("huddles").select("*, members(*)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const members = ((data.members ?? []) as Member[]).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return { ...data, location: data.location ?? undefined, notes: data.notes ?? undefined, members } as Huddle;
}

export async function addMember(huddleId: string, name: string, picks: Entity[]): Promise<Member> {
  const m: Member = { id: crypto.randomUUID(), name, picks, joined_at: new Date().toISOString() };
  if (!sb) {
    const h = mem.get(huddleId);
    if (!h) throw new Error("not found");
    h.members.push(m);
    h.result = null;
    return m;
  }
  const { error } = await sb.from("members").insert({ ...m, huddle_id: huddleId });
  if (error) throw new Error(error.message);
  await sb.from("huddles").update({ result: null }).eq("id", huddleId);
  return m;
}

export async function saveDecision(huddleId: string, result: Decision) {
  if (!sb) {
    const h = mem.get(huddleId);
    if (h) h.result = result;
    return;
  }
  const { error } = await sb.from("huddles").update({ result }).eq("id", huddleId);
  if (error) throw new Error(error.message);
}

/** One-tap "did this work for your group?" feedback; no personal data. */
export async function addFeedback(huddleId: string, vote: "up" | "down") {
  const entry = { vote, at: new Date().toISOString() };
  if (!sb) {
    const h = mem.get(huddleId);
    if (!h) throw new Error("not found");
    h.feedback = [...(h.feedback ?? []), entry].slice(-50);
    return;
  }
  const { data, error } = await sb.from("huddles").select("feedback").eq("id", huddleId).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "not found");
  const next = [...((data.feedback as unknown[]) ?? []), entry].slice(-50);
  const upd = await sb.from("huddles").update({ feedback: next }).eq("id", huddleId);
  if (upd.error) throw new Error(upd.error.message);
}
