/**
 * Budget guard for the Claude agent on a public deployment. When a limit is hit the app
 * still answers, using rule-based explanations, so judges never see an error.
 */
import "server-only";
import { createHash } from "node:crypto";
import { supabase } from "./store";

const DAILY = Number(process.env.AGENT_DAILY_LIMIT ?? 100);
const PER_IP_HOUR = Number(process.env.AGENT_IP_HOURLY_LIMIT ?? 6);

const g = globalThis as unknown as { __agentRuns?: { ip: string; at: number }[] };
const mem = (g.__agentRuns ??= []);

export function ipHash(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const salt = process.env.AGENT_IP_SALT ?? "tastebridge";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}

/** Reserve one agent run. Returns false (no reservation) when over budget. */
export async function reserveAgentRun(ip: string): Promise<{ ok: boolean; reason?: string }> {
  const now = Date.now();
  const dayAgo = new Date(now - 864e5).toISOString();
  const hourAgo = new Date(now - 36e5).toISOString();

  if (!supabase) {
    const recent = mem.filter((r) => r.at > now - 864e5);
    mem.splice(0, mem.length, ...recent);
    if (recent.length >= DAILY) return { ok: false, reason: "daily limit" };
    if (recent.filter((r) => r.ip === ip && r.at > now - 36e5).length >= PER_IP_HOUR)
      return { ok: false, reason: "hourly limit" };
    mem.push({ ip, at: now });
    return { ok: true };
  }

  const [day, hour] = await Promise.all([
    supabase.from("agent_runs").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ip)
      .gte("created_at", hourAgo),
  ]);
  // Fail closed on the expensive path: if we cannot count, use rules.
  if (day.error || hour.error) return { ok: false, reason: "usage check unavailable" };
  if ((day.count ?? 0) >= DAILY) return { ok: false, reason: "daily limit" };
  if ((hour.count ?? 0) >= PER_IP_HOUR) return { ok: false, reason: "hourly limit" };
  const { error } = await supabase.from("agent_runs").insert({ ip_hash: ip });
  return error ? { ok: false, reason: "usage check unavailable" } : { ok: true };
}

// ---------- light per-instance limits for cheap public endpoints (search, demo, create) ----------
const g2 = globalThis as unknown as { __hits?: Map<string, number[]> };
const hits: Map<string, number[]> = (g2.__hits ??= new Map());

/** Sliding-window counter per key (best effort: per server instance). */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const k of [...hits.keys()].slice(0, 1000)) hits.delete(k);
  return true;
}

export const tooMany = (what: string) =>
  Response.json({ error: `Too many ${what} from your network. Please wait a minute and try again.` }, { status: 429 });
