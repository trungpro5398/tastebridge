"use client";

import { useState } from "react";
import type { Decision, RankedCandidate } from "@/lib/types";

const W = 520;
const H = 300;
const PAD = { l: 52, r: 16, t: 16, b: 44 };
const x = (v: number) => PAD.l + v * (W - PAD.l - PAD.r);
const y = (v: number) => H - PAD.b - v * (H - PAD.t - PAD.b);
const pct = (v: number) => `${Math.round(v * 100)}%`;

type Point = { c: RankedCandidate; role: "fair" | "avg" | "other" };

/** Every shortlisted option: group average (x) vs the least-matched person (y). Up = nobody left behind. */
export default function FairnessChart({ decision }: { decision: Decision }) {
  const [hover, setHover] = useState<Point | null>(null);
  const fairId = decision.picks[0]?.entity_id;
  const avgId = decision.majority?.entity.entity_id;
  const all = [...decision.ranked];
  if (decision.majority && !all.some((r) => r.entity.entity_id === avgId)) all.push(decision.majority);
  if (all.length < 3) return null;
  const points: Point[] = all.map((c) => ({
    c,
    role: c.entity.entity_id === fairId ? "fair" : c.entity.entity_id === avgId ? "avg" : "other",
  }));
  // draw highlighted marks last so they sit on top
  points.sort((a, b) => (a.role === "other" ? -1 : 1) - (b.role === "other" ? -1 : 1));
  const color = (r: Point["role"]) =>
    r === "fair" ? "var(--chart-fair)" : r === "avg" ? "var(--chart-avg)" : "var(--muted)";
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const differs = fairId !== avgId;

  return (
    <figure className="rounded-3xl border border-line bg-card p-5 sm:p-6">
      <figcaption>
        <h3 className="font-display text-lg font-semibold">Every option, at a glance</h3>
        <p className="text-sm text-muted">
          Right means a higher group average. Up means the least-matched person is better off. TasteBridge picks the
          highest dot{differs ? "; a simple average picks the one furthest right" : ""}.
        </p>
      </figcaption>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Scatter of options by group average and lowest match">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
                {pct(t)}
              </text>
              <text x={x(t)} y={H - PAD.b + 18} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                {pct(t)}
              </text>
            </g>
          ))}
          <text x={(x(0) + x(1)) / 2} y={H - 6} textAnchor="middle" className="fill-[var(--muted)] text-[12px]">
            Group average match
          </text>
          <text
            transform={`translate(14 ${(y(0) + y(1)) / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-[var(--muted)] text-[12px]"
          >
            Lowest person&apos;s match
          </text>
          {points.map((p) => {
            const cx = x(p.c.mean_satisfaction);
            const cy = y(p.c.min_satisfaction);
            const r = p.role === "other" ? 5 : 7;
            return (
              <g
                key={p.c.entity.entity_id}
                tabIndex={0}
                onPointerEnter={() => setHover(p)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(p)}
                onBlur={() => setHover(null)}
                className="cursor-default outline-none"
              >
                <circle cx={cx} cy={cy} r={14} fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color(p.role)}
                  fillOpacity={p.role === "other" ? 0.45 : 1}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
                {p.role !== "other" && (
                  <text
                    x={cx + (p.c.mean_satisfaction > 0.7 ? -10 : 10)}
                    y={cy - 10}
                    textAnchor={p.c.mean_satisfaction > 0.7 ? "end" : "start"}
                    className="fill-[var(--foreground)] text-[12px] font-semibold"
                  >
                    {p.role === "fair" ? "Fair pick" : "Simple average"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-xl border border-line bg-card p-2.5 text-xs shadow-lg"
            style={{
              left: `${(x(hover.c.mean_satisfaction) / W) * 100}%`,
              top: `${(y(hover.c.min_satisfaction) / H) * 100}%`,
              transform: `translate(${hover.c.mean_satisfaction > 0.6 ? "-105%" : "8%"}, -110%)`,
            }}
          >
            <p className="truncate font-semibold">{hover.c.entity.name}</p>
            <p className="mt-1">
              <b className="text-sm">{pct(hover.c.mean_satisfaction)}</b> <span className="text-muted">group average</span>
            </p>
            <p>
              <b className="text-sm">{pct(hover.c.min_satisfaction)}</b> <span className="text-muted">lowest person</span>
            </p>
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: "var(--chart-fair)" }} /> Fair pick
        </li>
        {differs && (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: "var(--chart-avg)" }} /> Simple average pick
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full opacity-45" style={{ background: "var(--muted)" }} /> Other options
        </li>
      </ul>
      <table className="sr-only">
        <caption>Options by group average and lowest match</caption>
        <thead>
          <tr>
            <th>Option</th>
            <th>Group average</th>
            <th>Lowest person</th>
          </tr>
        </thead>
        <tbody>
          {all.map((c) => (
            <tr key={c.entity.entity_id}>
              <td>{c.entity.name}</td>
              <td>{pct(c.mean_satisfaction)}</td>
              <td>{pct(c.min_satisfaction)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
