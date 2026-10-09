"use client";

import { useEffect, useState } from "react";
import type { Entity } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  "urn:entity:movie": "Movie",
  "urn:entity:tv_show": "TV",
  "urn:entity:artist": "Artist",
  "urn:entity:book": "Book",
  "urn:entity:place": "Place",
  "urn:entity:podcast": "Podcast",
  "urn:entity:videogame": "Game",
};

export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.replace("urn:entity:", "");

export default function FavouritePicker({
  value,
  onChange,
  max = 3,
}: {
  value: Entity[];
  onChange: (v: Entity[]) => void;
  max?: number;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`).catch(() => null);
      const data: Entity[] = res?.ok ? await res.json().catch(() => []) : [];
      if (!cancelled) {
        setNotice(
          res?.status === 429
            ? "Lots of searches right now. Give it a few seconds."
            : res && !res.ok
              ? "Search is busy. Try again in a moment."
              : !res
                ? "You seem to be offline."
                : "",
        );
        setResults(data.filter((e) => !value.some((v) => v.entity_id === e.entity_id)));
        setActive(0);
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      cancelled = true;
    };
  }, [q, value]);

  function add(e: Entity) {
    if (value.length >= max) return;
    onChange([...value, e]);
    setQ("");
    setResults([]);
  }

  const full = value.length >= max;
  const open = q.trim().length >= 2 && !full;

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {value.map((e) => (
          <li key={e.entity_id} className="flex items-center gap-1.5 rounded-full bg-soft py-1 pl-3 pr-1.5 text-sm">
            <span className="text-xs text-muted">{typeLabel(e.type)}</span>
            {e.name}
            <button
              type="button"
              aria-label={`Remove ${e.name}`}
              onClick={() => onChange(value.filter((v) => v.entity_id !== e.entity_id))}
              className="grid size-5 place-items-center rounded-full hover:bg-line"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Films, shows, artists or books you love. Mix them up!</p>
      <div className="relative mt-2">
        <input
          aria-label="Search favourites"
          value={q}
          disabled={full}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              add(results[active]);
            }
          }}
          placeholder={full ? "Nice picks!" : `Search a favourite (${value.length}/${max})`}
          role="combobox"
          aria-expanded={open}
          aria-controls="fav-results"
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-brand disabled:opacity-60"
        />
        {open && (
          <ul
            id="fav-results"
            role="listbox"
            className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-card shadow-lg"
          >
            {loading && !results.length && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
            {!loading && !results.length && (
              <li className="px-3 py-2 text-sm text-muted">{notice || "No matches yet. Try the full title or artist name."}</li>
            )}
            {results.map((e, i) => (
              <li
                key={e.entity_id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  add(e);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? "bg-soft" : ""}`}
              >
                {e.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" className="size-9 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-lg bg-soft text-xs text-muted">
                    {typeLabel(e.type).slice(0, 2)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {typeLabel(e.type)}
                    {e.meta ? ` · ${e.meta}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
