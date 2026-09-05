import { ImageResponse } from "next/og";

export const alt = "RouteAlpha — Observable AI routing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #134e4a 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "72px", height: "72px", borderRadius: "20px", background: "white", color: "#0f172a", fontSize: "32px", fontWeight: 700 }}>RA</div>
          <div style={{ fontSize: "40px", fontWeight: 600 }}>RouteAlpha</div>
        </div>
        <div style={{ marginTop: "48px", fontSize: "64px", fontWeight: 600, lineHeight: 1.15, maxWidth: "980px" }}>
          Route every AI request with an explicit policy.
        </div>
        <div style={{ marginTop: "32px", fontSize: "28px", color: "#99f6e4", maxWidth: "900px" }}>
          Cost, latency, and quality routing with full observability.
        </div>
      </div>
    ),
    size
  );
}
