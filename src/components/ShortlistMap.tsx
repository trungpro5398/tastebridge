"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Decision } from "@/lib/types";

/** Where tonight's shortlist is: fair pick, simple-average pick and the other options. */
export default function ShortlistMap({ decision }: { decision: Decision }) {
  const el = useRef<HTMLDivElement>(null);
  const fairId = decision.picks[0]?.entity_id;
  const avgId = decision.majority?.entity.entity_id;
  const all = [...decision.ranked];
  if (decision.majority && !all.some((r) => r.entity.entity_id === avgId)) all.push(decision.majority);
  const located = all.filter((r) => r.entity.lat !== undefined && r.entity.lon !== undefined);

  useEffect(() => {
    if (!el.current || located.length < 2) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const css = getComputedStyle(document.documentElement);
      const fair = css.getPropertyValue("--chart-fair").trim() || "#7b3fb0";
      const avg = css.getPropertyValue("--chart-avg").trim() || "#c27c0e";
      const other = css.getPropertyValue("--muted").trim() || "#6b6477";
      // others first so the highlighted pins sit on top
      const ordered = [...located].sort((a, b) => Number(a.entity.entity_id === fairId || a.entity.entity_id === avgId) - Number(b.entity.entity_id === fairId || b.entity.entity_id === avgId));
      for (const r of ordered) {
        const role = r.entity.entity_id === fairId ? "fair" : r.entity.entity_id === avgId ? "avg" : "other";
        const marker = L.circleMarker([r.entity.lat!, r.entity.lon!], {
          radius: role === "other" ? 6 : 10,
          color: "#ffffff",
          weight: 2,
          fillColor: role === "fair" ? fair : role === "avg" ? avg : other,
          fillOpacity: role === "other" ? 0.6 : 1,
        }).addTo(map);
        const label = role === "fair" ? "Fair pick: " : role === "avg" ? "Simple average: " : "";
        const tip = document.createElement("span");
        tip.textContent = `${label}${r.entity.name} (lowest match ${Math.round(r.min_satisfaction * 100)}%)`;
        marker.bindTooltip(tip, { direction: "top", permanent: role !== "other" && located.length <= 12 });
      }
      map.fitBounds(L.latLngBounds(located.map((r) => [r.entity.lat!, r.entity.lon!] as [number, number])), {
        padding: [36, 36],
        maxZoom: 15,
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
    // re-draw only when the decision changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision.created_at]);

  if (located.length < 2) return null;
  return (
    <figure className="overflow-hidden rounded-3xl border border-line bg-card">
      <div ref={el} className="h-72 w-full sm:h-80" aria-label="Map of tonight's shortlist" role="region" />
      <figcaption className="px-5 py-3 text-sm text-muted">
        Tonight&apos;s shortlist on the map. Purple is the fair pick
        {fairId !== avgId ? ", amber is what a simple average would choose" : ""}.
      </figcaption>
    </figure>
  );
}
