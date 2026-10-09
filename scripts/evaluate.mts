/**
 * Offline evaluation: how much does maximin protect the least-matched member compared with
 * picking the highest average, on live Qloo data?
 *
 *   QLOO_API_KEY=... node --conditions=react-server --import tsx scripts/evaluate.mts [groups=20] [seed=7]
 *
 * Builds random groups (3–5 people, 3 favourites each) from a fixed pool of well-known titles and
 * artists, runs the same rule-based pipeline the app uses (no Claude), and prints aggregate stats.
 * Only aggregate numbers are printed; no Qloo responses are written to disk.
 */
import { readFileSync } from "node:fs";

for (const l of (() => {
  try {
    return readFileSync(".env.local", "utf8").split("\n");
  } catch {
    return [];
  }
})()) {
  const m = l.match(/^([A-Z_]+)=(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { searchEntities, qlooMode } = await import("../src/lib/qloo.ts");
const { DecisionSession } = await import("../src/lib/decide.ts");
type Entity = import("../src/lib/types.ts").Entity;
type EntityType = import("../src/lib/types.ts").EntityType;
type Huddle = import("../src/lib/types.ts").Huddle;

const GROUPS = Number(process.argv[2] ?? 20);
let seed = Number(process.argv[3] ?? 7);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pickN = <T,>(xs: T[], n: number) => [...xs].sort(() => rand() - 0.5).slice(0, n);

const POOL: [string, EntityType][] = [
  ["Spirited Away", "urn:entity:movie"], ["Mad Max: Fury Road", "urn:entity:movie"], ["Parasite", "urn:entity:movie"],
  ["The Notebook", "urn:entity:movie"], ["John Wick", "urn:entity:movie"], ["Amélie", "urn:entity:movie"],
  ["Interstellar", "urn:entity:movie"], ["Mean Girls", "urn:entity:movie"], ["The Godfather", "urn:entity:movie"],
  ["Ratatouille", "urn:entity:movie"], ["The Bear", "urn:entity:tv_show"], ["Severance", "urn:entity:tv_show"],
  ["Ted Lasso", "urn:entity:tv_show"], ["Breaking Bad", "urn:entity:tv_show"], ["Bluey", "urn:entity:tv_show"],
  ["Friends", "urn:entity:tv_show"], ["Taylor Swift", "urn:entity:artist"], ["Radiohead", "urn:entity:artist"],
  ["Kendrick Lamar", "urn:entity:artist"], ["Norah Jones", "urn:entity:artist"], ["Daft Punk", "urn:entity:artist"],
  ["BTS", "urn:entity:artist"], ["Metallica", "urn:entity:artist"], ["Adele", "urn:entity:artist"],
];

if (qlooMode !== "live") console.warn("QLOO_API_KEY not set: running on the offline demo catalogue.");

const pool: Entity[] = [];
for (const [name, type] of POOL) {
  const [hit] = await searchEntities(name, [type], 1);
  if (hit) pool.push(hit);
}
console.log(`pool: ${pool.length} favourites resolved (${qlooMode})`);

type Row = {
  kind: string;
  fairMin: number;
  avgMin: number;
  fairMean: number;
  avgMean: number;
  differs: boolean;
  plainDiffers: boolean;
  /** protected person's raw Qloo affinity at the fair pick minus at the average pick */
  rawGain: number;
  /** that gain as a share of the person's own affinity spread over the shortlist */
  rawGainShare: number;
  flexible: number;
  people: number;
};
const rows: Row[] = [];
const kinds = ["place", "movie"] as const;

for (let g = 0; g < GROUPS; g++) {
  const kind = kinds[g % kinds.length];
  const n = 3 + Math.floor(rand() * 3);
  const huddle: Huddle = {
    id: `eval-${g}`,
    title: "eval",
    kind,
    location: kind === "place" ? "Melbourne" : undefined,
    created_at: "",
    members: Array.from({ length: n }, (_, i) => ({ id: `m${i}`, name: `P${i}`, joined_at: "", picks: pickN(pool, 3) })),
  };
  try {
    const s = new DecisionSession(huddle);
    await s.generateCandidates({});
    await s.scoreMembers();
    if (!s.ranked.length || !s.majority) throw new Error("no candidates");
    const fair = s.ranked[0];
    const avg = s.majority;
    // what plain maximin over raw percentiles (no flexibility shrinkage) would have picked
    const plain = [...s.ranked].sort(
      (a, b) =>
        Math.min(...b.scores.map((x) => x.percentile ?? x.satisfaction)) -
        Math.min(...a.scores.map((x) => x.percentile ?? x.satisfaction)),
    )[0];
    const cares = avg.scores.filter((x) => !x.flexible);
    const who = [...(cares.length ? cares : avg.scores)].sort((a, b) => a.satisfaction - b.satisfaction)[0];
    const affOf = (c: typeof fair) => c.scores.find((x) => x.member_id === who.member_id)!.affinity;
    const all = s.ranked.map(affOf);
    const rawGain = affOf(fair) - affOf(avg);
    rows.push({
      kind,
      rawGain,
      rawGainShare: rawGain / Math.max(1e-6, Math.max(...all) - Math.min(...all)),
      fairMin: fair.min_satisfaction,
      avgMin: avg.min_satisfaction,
      fairMean: fair.mean_satisfaction,
      avgMean: avg.mean_satisfaction,
      differs: fair.entity.entity_id !== avg.entity.entity_id,
      plainDiffers: plain.entity.entity_id !== fair.entity.entity_id,
      flexible: fair.scores.filter((x) => x.flexible).length,
      people: n,
    });
    process.stdout.write(".");
  } catch (err) {
    process.stdout.write("x");
    console.error(`\ngroup ${g}: ${(err as Error).message}`);
  }
}

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pp = (x: number) => `${(x * 100).toFixed(1)} pts`;
const differ = rows.filter((r) => r.differs);
const people = rows.reduce((a, r) => a + r.people, 0);
const flexible = rows.reduce((a, r) => a + r.flexible, 0);
console.log(`\n\ngroups evaluated: ${rows.length} (${rows.filter((r) => r.kind === "place").length} dinner, ${rows.filter((r) => r.kind === "movie").length} movie)`);
console.log(`people flagged "flexible tonight": ${flexible}/${people} (${((100 * flexible) / Math.max(1, people)).toFixed(0)}%)`);
console.log(`fair pick differs from the highest-average pick: ${differ.length}/${rows.length} (${((100 * differ.length) / Math.max(1, rows.length)).toFixed(0)}%)`);
console.log(`  gain where they differ: +${pp(mean(differ.map((r) => r.fairMin - r.avgMin)))} for the least-matched person with a preference`);
console.log(`  cost where they differ: -${pp(mean(differ.map((r) => r.avgMean - r.fairMean)))} of group-average match`);
console.log(`  raw Qloo affinity gain for that person: median +${median(differ.map((r) => r.rawGain)).toFixed(3)}, i.e. ${(100 * median(differ.map((r) => r.rawGainShare))).toFixed(0)}% of their own spread over the shortlist`);
console.log(`flexibility-awareness changed the pick vs plain maximin: ${rows.filter((r) => r.plainDiffers).length}/${rows.length}`);
