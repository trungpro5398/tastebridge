"use client";

import { useState } from "react";
import { initials } from "@/lib/members";
import type { Decision, RankedCandidate } from "@/lib/types";

const SIZE = 340;
const C = SIZE / 2;
const R = 128;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Each friend is a corner; each option sits at the match-weighted average of the corners, so it
 * drifts toward the people it suits. Options that suit everyone sit near the middle: the bridge.
 */
export default function TasteMap({ decision, colors }: { decision: Decision; colors: Record<string, string> }) {
  const [hover, setHover] = useState<RankedCandidate | null>(null);
  const top = decision.ranked.find((r) => r.entity.entity_id === decision.picks[0]?.entity_id) ?? decision.ranked[0];
  if (!top || top.scores.length < 2) return null;

  const people = top.scores.map((s, i, all) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / all.length;
    return { id: s.member_id, name: s.member_name, flexible: !!s.flexible, x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
  });
  const options = [...decision.ranked];
  const avgId = decision.majority?.entity.entity_id;
  if (decision.majority && !options.some((o) => o.entity.entity_id === avgId)) options.push(decision.majority);

  // Each option is pushed away from the one person it suits least, further the more it leaves them
  // behind the others. Options that leave nobody behind stay in the middle: that is the bridge.
  const offset = (c: RankedCandidate) => {
    const sats = people.map((p) => c.scores.find((x) => x.member_id === p.id)?.satisfaction ?? 0);
    const mean = sats.reduce((a, b) => a + b, 0) / sats.length;
    const worst = sats.indexOf(Math.min(...sats));
    const gap = mean - sats[worst];
    const p = people[worst];
    return { dx: (-gap * (p.x - C)) / R, dy: (-gap * (p.y - C)) / R };
  };
  const spread = Math.max(0.2, ...options.map((c) => Math.hypot(offset(c).dx, offset(c).dy)));
  const place = (c: RankedCandidate) => {
    const { dx, dy } = offset(c);
    const k = (R * 0.8) / spread; // the most lopsided option reaches 80% of the way to the opposite corner
    return { x: C + dx * k, y: C + dy * k };
  };
  const short = (n: string) => (n.length > 18 ? `${n.slice(0, 17).trimEnd()}…` : n);
  const labelFor = (c: RankedCandidate, r: string) => {
    if (r === "fair") return `${short(c.entity.name)} (fair pick)`;
    const low = [...c.scores].filter((x) => !x.flexible).sort((a, b) => a.satisfaction - b.satisfaction)[0];
    return low ? `${short(c.entity.name)}: ${low.member_name} ${pct(low.satisfaction)}` : short(c.entity.name);
  };
  const role = (c: RankedCandidate) =>
    c.entity.entity_id === top.entity.entity_id ? "fair" : c.entity.entity_id === avgId ? "avg" : "other";
  const ordered = [...options].sort((a, b) => (role(a) === "other" ? -1 : 1) - (role(b) === "other" ? -1 : 1));
  const differs = avgId && avgId !== top.entity.entity_id;

  return (
    <figure className="rounded-3xl border border-line bg-card p-5 sm:p-6">
      <figcaption>
        <h3 className="font-display text-lg font-semibold">Taste map: where the bridge is</h3>
        <p className="text-sm text-muted">
          Each person is a corner. Every option is pushed away from the person it suits least, further the more it
          leaves them behind. Options that leave nobody behind stay in the middle: that is the bridge.
        </p>
      </figcaption>
      <div className="relative mx-auto mt-3 max-w-[420px]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label="Taste map of tonight's options between group members">
          <polygon
            points={people.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="var(--soft)"
            stroke="var(--line)"
            strokeWidth={1.5}
          />
          <circle cx={C} cy={C} r={3} fill="var(--muted)" opacity={0.5} />
          {ordered.map((c) => {
            const { x, y } = place(c);
            const r = role(c);
            return (
              <g
                key={c.entity.entity_id}
                tabIndex={0}
                onPointerEnter={() => setHover(c)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(c)}
                onBlur={() => setHover(null)}
                className="outline-none"
              >
                <circle cx={x} cy={y} r={13} fill="transparent" />
                <circle
                  cx={x}
                  cy={y}
                  r={r === "other" ? 4.5 : 8}
                  fill={r === "fair" ? "var(--chart-fair)" : r === "avg" ? "var(--chart-avg)" : "var(--muted)"}
                  fillOpacity={r === "other" ? 0.45 : 1}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
                {r !== "other" && <DotLabel x={x} y={y} text={labelFor(c, r)} />}
              </g>
            );
          })}
          {people.map((p) => (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill={p.flexible ? "var(--card)" : colors[p.id] ?? "var(--muted)"}
                stroke={colors[p.id] ?? "var(--muted)"}
                strokeWidth={p.flexible ? 2.5 : 0}
                strokeDasharray={p.flexible ? "4 3" : undefined}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className="text-[11px] font-semibold"
                fill={p.flexible ? colors[p.id] ?? "var(--muted)" : "#fff"}
              >
                {initials(p.name)}
              </text>
              <text
                x={p.x}
                y={p.y + (p.y > C ? 32 : -24)}
                textAnchor="middle"
                className="fill-[var(--foreground)] text-[11px]"
              >
                {p.name}
                {p.flexible ? " (flexible)" : ""}
              </text>
            </g>
          ))}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 w-60 -translate-x-1/2 rounded-xl border border-line bg-card p-2.5 text-xs shadow-lg">
            <p className="truncate font-semibold">{hover.entity.name}</p>
            <p className="mt-1 text-muted">
              {hover.scores.map((s) => `${s.member_name} ${pct(s.satisfaction)}`).join(" · ")}
            </p>
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: "var(--chart-fair)" }} /> Fair pick (the bridge)
        </li>
        {differs && (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: "var(--chart-avg)" }} /> Simple average pick
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full opacity-45" style={{ background: "var(--muted)" }} /> Other options
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-dashed border-[var(--muted)]" /> Flexible tonight
        </li>
      </ul>
      <div className="sr-only">
        <table>
          <caption>Taste match per option and person</caption>
          <thead>
            <tr>
              <th>Option</th>
              {people.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.map((c) => (
              <tr key={c.entity.entity_id}>
                <td>{c.entity.name}</td>
                {people.map((p) => (
                  <td key={p.id}>{pct(c.scores.find((s) => s.member_id === p.id)?.satisfaction ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function DotLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const right = x > C + 40;
  return (
    <text
      x={right ? x - 12 : x + 12}
      y={y + 4}
      textAnchor={right ? "end" : "start"}
      className="pointer-events-none fill-[var(--foreground)] text-[10px] font-semibold"
      paintOrder="stroke"
      stroke="var(--card)"
      strokeWidth={3}
    >
      {text}
    </text>
  );
}
