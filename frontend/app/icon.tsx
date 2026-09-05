import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "14px",
          background: "#0f172a",
          color: "white",
          fontSize: "28px",
          fontWeight: 700,
        }}
      >
        RA
      </div>
    ),
    size
  );
}
