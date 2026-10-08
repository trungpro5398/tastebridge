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
