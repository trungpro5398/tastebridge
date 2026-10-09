import { ImageResponse } from "next/og";
import { getHuddle } from "@/lib/store";

export const alt = "A TasteBridge huddle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const huddle = await getHuddle(id).catch(() => null);
  const pick = huddle?.result?.picks[0];
  const top = pick && huddle?.result?.ranked.find((r) => r.entity.entity_id === pick.entity_id);
  const names = huddle?.members.map((m) => m.name).join(", ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f7f7fa",
          color: "#221a2e",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: "#5b2a86",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⌒
          </div>
          TasteBridge
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 36, color: "#5b2a86" }}>{huddle?.title ?? "Group huddle"}</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>
            {pick ? pick.headline : "Add your 3 favourites so we can decide"}
          </div>
          <div style={{ fontSize: 30, color: "#6b6477" }}>
            {top
              ? `Everyone's taste match is ${Math.round(top.min_satisfaction * 100)}% or higher`
              : names
                ? `In so far: ${names}`
                : "Films, shows, artists or books. Takes 30 seconds."}
          </div>
        </div>
        <div style={{ fontSize: 26, color: "#6b6477" }}>Fair group picks, powered by Qloo × Claude</div>
      </div>
    ),
    size,
  );
}
