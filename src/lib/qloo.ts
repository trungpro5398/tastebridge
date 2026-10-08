/**
 * Thin Qloo client (hackathon environment) with an offline mock.
 * Docs: docs/qloo/NOTES.md. All calls are server-side; the key never reaches the browser.
 */
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { MOCK_BY_ID, MOCK_ENTITIES } from "./mock-data";
import type { Entity, EntityType, InsightEntity, QlooCall } from "./types";

const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;

export const qlooMode: "live" | "mock" = KEY ? "live" : "mock";

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// ---------- provenance: every Qloo request made during one decision (no key, no member names) ----------
const calls = new AsyncLocalStorage<QlooCall[]>();

/** Run fn and collect a redacted log of the Qloo requests it made. */
export async function withQlooLog<T>(fn: () => Promise<T>): Promise<{ result: T; calls: QlooCall[] }> {
  const log: QlooCall[] = [];
  const result = await calls.run(log, fn);
  return { result, calls: log };
}

type Params = Record<string, string | number | boolean | undefined>;

/** Entity-id lists are summarised as counts; tag ids, types and filters stay readable. */
function redact(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    const s = String(v);
    out[k] = k.endsWith(".entities") ? `${s.split(",").length} entity id(s)` : s;
  }
  return out;
}

function record(endpoint: string, params: Params, results: number, source: QlooCall["source"], started: number) {
  calls.getStore()?.push({ endpoint, params: redact(params), results, source, ms: Date.now() - started });
}

function countResults(data: unknown) {
  const r = (data as Raw | undefined)?.results as Raw | Raw[] | undefined;
  if (Array.isArray(r)) return r.length;
  for (const k of ["entities", "tags"]) if (Array.isArray(r?.[k])) return (r![k] as unknown[]).length;
  return r ? 1 : 0;
}

// ---------- cache (server-side only, never persisted to the repo) ----------
const CACHE_TTL_MS = 30 * 60 * 1000;
const g = globalThis as unknown as { __qlooCache?: Map<string, { at: number; data: unknown }> };
const cache = (g.__qlooCache ??= new Map());

async function get(path: string, params: Params) {
  const started = Date.now();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${BASE}${path}?${qs}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    record(path, params, countResults(hit.data), "cache", started);
    return hit.data;
  }

  const res = await fetch(url, {
    headers: { "X-Api-Key": KEY!, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => { throw new QlooError("The taste service could not be reached."); });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new QlooError(`Qloo ${path} → ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  record(path, params, countResults(data), "qloo", started);
  return data;
}

// ---------- defensive parsing (invalid params are silently ignored by Qloo, shapes vary by type) ----------
type Raw = Record<string, unknown>;
const asArr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function toEntity(r: Raw): Entity {
  const props = (r.properties ?? {}) as Raw;
  const image = (props.image as Raw | undefined)?.url as string | undefined;
  const type =
    (r.subtype as string) ?? (r.type as string) ?? (asArr(r.types)[0] as unknown as string) ?? "urn:entity";
  const year = props.release_year ?? props.publication_year;
  const addr = (props.address as string) ?? (r.location as Raw | undefined)?.address;
  const price = num(props.price_level);
  const meta = [year, addr, price ? "$".repeat(price) : undefined].filter(Boolean).join(" · ") || undefined;
  return {
    entity_id: String(r.entity_id ?? r.id),
    name: String(r.name ?? "Unknown"),
    type,
    image,
    description: (props.description as string) ?? undefined,
    tags: asArr(r.tags)
      .slice(0, 12)
      .map((t) => ({ id: String(t.id ?? t.tag_id), name: String(t.name) })),
    meta,
  };
}

/** Collect {entity_id → contribution} from wherever explainability puts it. */
function parseExplain(node: unknown, out: Record<string, number> = {}, depth = 0): Record<string, number> {
  if (!node || typeof node !== "object" || depth > 5) return out;
  if (Array.isArray(node)) {
    node.forEach((n) => parseExplain(n, out, depth + 1));
    return out;
  }
  const o = node as Raw;
  const id = (o.entity_id ?? o.id) as string | undefined;
  const score = num(o.score) ?? num(o.weight) ?? num(o.contribution) ?? num(o.affinity);
  if (id && score !== undefined) out[id] = Math.max(out[id] ?? 0, score);
  for (const v of Object.values(o)) if (typeof v === "object") parseExplain(v, out, depth + 1);
  return out;
}

// ---------- public API ----------
export async function searchEntities(query: string, types?: EntityType[], take = 8): Promise<Entity[]> {
  if (qlooMode === "mock") {
    const started = Date.now();
    const q = query.toLowerCase();
    const out = MOCK_ENTITIES.filter(
      (e) => e.name.toLowerCase().includes(q) && (!types?.length || types.includes(e.type as EntityType)),
    ).slice(0, take);
    record("/search", { query, types: types?.join(","), take }, out.length, "offline", started);
    return out;
  }
  const data = (await get("/search", { query, types: types?.join(","), take })) as Raw;
  return asArr(data.results).map(toEntity);
}

export async function findTags(query: string, take = 8): Promise<{ id: string; name: string }[]> {
  if (qlooMode === "mock") {
    const started = Date.now();
    const names = new Set(MOCK_ENTITIES.flatMap((e) => e.tags!.map((t) => t.name)));
    const out = [...names]
      .filter((n) => n.includes(query.toLowerCase()))
      .slice(0, take)
      .map((n) => ({ id: `urn:tag:mock:${n}`, name: n }));
    record("/v2/tags", { "filter.query": query, take }, out.length, "offline", started);
    return out;
  }
  const data = (await get("/v2/tags", { "filter.query": query, "feature.typo_tolerance": true, take })) as Raw;
  const results = data.results as Raw | Raw[] | undefined;
  const tags = Array.isArray(results) ? results : asArr(results?.tags);
  return tags.map((t) => ({ id: String(t.id ?? t.tag_id), name: String(t.name) }));
}

export type InsightsQuery = {
  type: EntityType;
  /** taste signal: entity ids the person/group loves */
  signal: string[];
  /** restrict scoring to these candidates (per-member scoring of a shared shortlist) */
  candidates?: string[];
  location?: string;
  tags?: string[];
  priceMax?: number;
  take?: number;
};

export async function insights(q: InsightsQuery): Promise<InsightEntity[]> {
  if (!q.signal.length) return [];
  const isPlace = q.type === "urn:entity:place";
  const params: Params = {
    "filter.type": q.type,
    "signal.interests.entities": q.signal.join(","),
    "filter.results.entities": q.candidates?.join(","),
    "filter.location.query": isPlace ? q.location : undefined,
    "filter.tags": q.tags?.join(","),
    "operator.filter.tags": q.tags?.length ? "intersection" : undefined,
    "filter.price_level.max": isPlace ? q.priceMax : undefined,
    "feature.explainability": true,
    take: Math.min(q.take ?? 20, 50),
  };
  if (qlooMode === "mock") {
    const started = Date.now();
    const out = mockInsights(q);
    record("/v2/insights", params, out.length, "offline", started);
    return out;
  }
  const data = (await get("/v2/insights", params)) as Raw;
  const ents = asArr((data.results as Raw | undefined)?.entities);
  return ents.map((r) => {
    const query = (r.query ?? {}) as Raw;
    return {
      ...toEntity(r),
      affinity: num(query.affinity) ?? num(r.affinity) ?? 0,
      popularity: num(r.popularity),
      explain: parseExplain(query.explainability),
    };
  });
}

/** Qloo Analysis Compare; only called in live mode. */
export async function compareTastes(a: string[], b: string[], type: EntityType) {
  const data = (await get("/v2/analysis/compare", {
    "a.signal.interests.entities": a.join(","),
    "b.signal.interests.entities": b.join(","),
    "filter.type": type,
    take: 5,
  })) as Raw;
  return data.results ?? null;
}

// ---------- mock scoring: tag overlap, deterministic ----------
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function mockInsights(q: InsightsQuery): InsightEntity[] {
  const signal = q.signal.map((id) => MOCK_BY_ID.get(id)).filter((e): e is Entity => !!e);
  const pool = MOCK_ENTITIES.filter(
    (e) =>
      e.type === q.type &&
      !q.signal.includes(e.entity_id) &&
      (!q.candidates || q.candidates.includes(e.entity_id)) &&
      (!q.tags?.length || q.tags.every((t) => e.tags!.some((et) => et.id === t))) &&
      (!q.priceMax || (e.meta?.match(/\$+/)?.[0].length ?? 1) <= q.priceMax),
  );
  return pool
    .map((c) => {
      const ct = new Set(c.tags!.map((t) => t.name));
      const explain: Record<string, number> = {};
      let total = 0;
      for (const s of signal) {
        const overlap = s.tags!.filter((t) => ct.has(t.name)).length;
        const sim = overlap / Math.sqrt(ct.size * s.tags!.length);
        if (sim > 0) explain[s.entity_id] = sim;
        total += sim;
      }
      const affinity = Math.min(0.99, 0.25 + 0.6 * (total / Math.max(1, signal.length)) + 0.12 * hash(c.entity_id + q.signal.join()));
      const max = Math.max(0, ...Object.values(explain));
      for (const k in explain) explain[k] = +(explain[k] / (max || 1)).toFixed(3);
      return { ...c, affinity: +affinity.toFixed(4), explain };
    })
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, q.take ?? 20);
}
