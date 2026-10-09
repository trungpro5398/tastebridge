import { initials } from "@/lib/members";

export type CompareOption = { label: string; name: string; values: number[]; fair: boolean };

/**
 * The product in one picture: what a simple average picks next to the fair pick, one bar per person.
 * The person the average leaves behind keeps full colour; everyone else is muted on the average side.
 */
export default function CompareBars({
  options,
  people,
  highlight,
}: {
  options: CompareOption[];
  people: { name: string; color: string }[];
  /** index of the person the simple average leaves behind */
  highlight?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {options.map((o) => (
        <div key={o.label} className={`rounded-2xl p-3 ${o.fair ? "bg-accent/15" : "bg-soft"}`}>
          <p className="text-xs text-muted">{o.label}</p>
          <p className="mt-0.5 min-h-[2.5rem] text-sm font-semibold leading-tight">{o.name}</p>
          <div className="mt-3 flex h-28 items-end gap-2" role="img" aria-label={people.map((p, i) => `${p.name} ${o.values[i]}%`).join(", ")}>
            {o.values.map((v, i) => {
              const muted = !o.fair && highlight !== undefined && i !== highlight;
              return (
                <div key={people[i].name} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className={`text-[11px] tabular-nums ${!o.fair && i === highlight ? "font-semibold text-foreground" : "text-muted"}`}>
                    {v}
                  </span>
                  <div className="w-full rounded-t-md" style={{ height: `${Math.max(v, 3)}%`, background: people[i].color, opacity: muted ? 0.45 : 1 }} />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-2">
            {people.map((p) => (
              <span key={p.name} className="flex-1 truncate text-center text-[11px] font-semibold" style={{ color: p.color }}>
                {initials(p.name)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
