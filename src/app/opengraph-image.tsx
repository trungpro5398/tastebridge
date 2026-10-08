import { ImageResponse } from "next/og";

export const alt = "TasteBridge: decide together, fairly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "#fbf7f2",
          color: "#1f1a17",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#e2553a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
            }}
          >
            ⌒
          </div>
          TasteBridge
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.05 }}>Stop arguing about where to eat.</div>
          <div style={{ fontSize: 34, color: "#6f655d" }}>
            One fair pick for the whole group, with the Qloo evidence behind it.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            ["Mai", 69, "#d97706"],
            ["Josh", 46, "#d97706"],
            ["Priya", 77, "#2f6f5e"],
            ["Leo", 100, "#2f6f5e"],
          ].map(([n, v, c]) => (
            <div key={n as string} style={{ display: "flex", flexDirection: "column", gap: 8, width: 240 }}>
              <div style={{ fontSize: 26, display: "flex", justifyContent: "space-between" }}>
                <span>{n}</span>
                <span style={{ color: "#6f655d" }}>{v}%</span>
              </div>
              <div style={{ height: 14, borderRadius: 7, background: "#f0e6da", display: "flex" }}>
                <div style={{ width: `${v}%`, height: 14, borderRadius: 7, background: c as string }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
