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
  /** demo/test huddles are kept out of the impact numbers */
  isDemo?: boolean;
}): Promise<Huddle> {
  const { isDemo, ...fields } = input;
  const h: Huddle = { id: newHuddleId(), created_at: new Date().toISOString(), members: [], result: null, ...fields };
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
    // anything not created on the production deployment (local dev, smoke tests) counts as test data
    is_demo: !!isDemo || process.env.VERCEL_ENV !== "production",
  });
  if (error) throw new Error(error.message);
  return h;
}

export async function getHuddle(id: string): Promise<Huddle | null> {
  if (!sb) return mem.get(id) ?? null;
  // never select members.edit_token: this object is returned to anyone with the link
  const { data, error } = await sb
    .from("huddles")
    .select("id, title, kind, location, notes, result, created_at, members(id, name, picks, joined_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const members = ((data.members ?? []) as Member[]).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return { ...data, location: data.location ?? undefined, notes: data.notes ?? undefined, members } as Huddle;
}

const memAvoids = ((globalThis as unknown as { __avoids?: Map<string, string> }).__avoids ??= new Map());

/** Private "not tonight" requests by member id. Server-only: used by the decision, never returned to clients. */
export async function getPrivateAvoids(huddleId: string): Promise<Record<string, string>> {
  if (!sb) {
    const h = mem.get(huddleId);
    const members: Member[] = h?.members ?? [];
    return Object.fromEntries(members.flatMap((m) => (memAvoids.get(m.id) ? [[m.id, memAvoids.get(m.id)!]] : [])));
  }
  const { data, error } = await sb.from("members").select("id, avoid").eq("huddle_id", huddleId).not("avoid", "is", null);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.id as string, r.avoid as string]));
}

const memTokens = ((globalThis as unknown as { __tokens?: Map<string, string> }).__tokens ??= new Map());

/** Adds a member and returns a secret edit token that only this member's browser ever sees. */
export async function addMember(
  huddleId: string,
  name: string,
  picks: Entity[],
  avoid?: string,
): Promise<Member & { editToken: string }> {
  const m: Member = { id: crypto.randomUUID(), name, picks, joined_at: new Date().toISOString() };
  const editToken = crypto.randomUUID();
  if (!sb) {
    const h = mem.get(huddleId);
    if (!h) throw new Error("not found");
    h.members.push(m);
    h.result = null;
    memTokens.set(m.id, editToken);
    if (avoid) memAvoids.set(m.id, avoid);
    return { ...m, editToken };
  }
  const { error } = await sb.from("members").insert({ ...m, huddle_id: huddleId, edit_token: editToken, avoid: avoid || null });
  if (error) throw new Error(error.message);
  await sb.from("huddles").update({ result: null }).eq("id", huddleId);
  return { ...m, editToken };
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

export type FeedbackQuestion = "worked" | "clear" | "went";

/** One-tap answers after a decision ("did it work?", "were the % clear?", "did you go?"); no personal data. */
export async function addFeedback(huddleId: string, q: FeedbackQuestion, a: "yes" | "no", ipHash = "local") {
  if (!sb) {
    const h = mem.get(huddleId);
    if (!h) throw new Error("not found");
    h.feedback = [...(h.feedback ?? []), { q, a, at: new Date().toISOString() }].slice(-50);
    return;
  }
  // append-only rows: concurrent answers can't overwrite each other
  // unique (huddle_id, q, ip_hash): a repeat answer updates instead of adding a row
  const { error } = await sb
    .from("feedback")
    .upsert({ huddle_id: huddleId, q, a, ip_hash: ipHash, at: new Date().toISOString() }, { onConflict: "huddle_id,q,ip_hash" });
  if (error) throw new Error(error.message);
}

// ---------- tiny server-side cache (kv table), e.g. resolved demo favourites ----------
const kvMem = ((globalThis as unknown as { __kv?: Map<string, { at: number; value: unknown }> }).__kv ??= new Map());

export async function kvGet<T>(key: string, maxAgeMs: number): Promise<T | null> {
  if (!sb) {
    const hit = kvMem.get(key);
    return hit && Date.now() - hit.at < maxAgeMs ? (hit.value as T) : null;
  }
  const { data } = await sb.from("kv").select("value, updated_at").eq("key", key).maybeSingle();
  if (!data || Date.now() - new Date(data.updated_at as string).getTime() > maxAgeMs) return null;
  return data.value as T;
}

export async function kvSet(key: string, value: unknown) {
  if (!sb) return void kvMem.set(key, { at: Date.now(), value });
  await sb.from("kv").upsert({ key, value, updated_at: new Date().toISOString() });
}

// ---------- "a decision is running" marker, so friends don't start a second run ----------
const DECIDING_TTL_MS = 120_000;

export async function isDeciding(huddleId: string) {
  const v = await kvGet<{ active: boolean }>(`deciding:${huddleId}`, DECIDING_TTL_MS).catch(() => null);
  return !!v?.active;
}

export async function setDeciding(huddleId: string, active: boolean) {
  await kvSet(`deciding:${huddleId}`, { active }).catch(() => {});
}

/** Remove a member (the member id, kept in their browser, acts as the edit token). Clears the result. */
export async function removeMember(huddleId: string, memberId: string, editToken: string): Promise<boolean> {
  if (!editToken) return false;
  if (!sb) {
    const h = mem.get(huddleId);
    if (!h || memTokens.get(memberId) !== editToken) return false;
    const before = h.members.length;
    h.members = h.members.filter((m: Member) => m.id !== memberId);
    if (h.members.length === before) return false;
    h.result = null;
    return true;
  }
  const { data, error } = await sb
    .from("members")
    .delete()
    .eq("huddle_id", huddleId)
    .eq("id", memberId)
    .eq("edit_token", editToken)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) return false;
  await sb.from("huddles").update({ result: null }).eq("id", huddleId);
  return true;
}
