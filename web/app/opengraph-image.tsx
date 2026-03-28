import { ImageResponse } from "next/og";

export const alt = "Lewis · Evans · Zerauschek · Cerpa — The Lewis Line";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#18181b",
          padding: "60px",
        }}
      >
        {/* Tree mark */}
        <svg
          width="72"
          height="72"
          viewBox="0 0 32 32"
          style={{ marginBottom: "32px" }}
        >
          <line
            x1="16" y1="29" x2="16" y2="18"
            stroke="#52525b" strokeWidth="3" strokeLinecap="round"
          />
          <line
            x1="16" y1="18" x2="10" y2="12"
            stroke="#52525b" strokeWidth="2.5" strokeLinecap="round"
          />
          <line
            x1="16" y1="18" x2="22" y2="12"
            stroke="#52525b" strokeWidth="2.5" strokeLinecap="round"
          />
          <line
            x1="10" y1="12" x2="6" y2="6"
            stroke="#71717a" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="10" y1="12" x2="14" y2="6"
            stroke="#71717a" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="22" y1="12" x2="18" y2="6"
            stroke="#71717a" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="22" y1="12" x2="26" y2="6"
            stroke="#71717a" strokeWidth="2" strokeLinecap="round"
          />
          <circle cx="6" cy="5" r="2.2" fill="#0ea5e9" />
          <circle cx="14" cy="5" r="2.2" fill="#0ea5e9" />
          <circle cx="18" cy="5" r="2.2" fill="#0ea5e9" />
          <circle cx="26" cy="5" r="2.2" fill="#0ea5e9" />
        </svg>

        <div
          style={{
            fontSize: "16px",
            letterSpacing: "0.3em",
            color: "#71717a",
            textTransform: "uppercase",
            marginBottom: "20px",
          }}
        >
          The Lewis Line
        </div>

        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#fafafa",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          Lewis · Evans · Zerauschek · Cerpa
        </div>

        <div
          style={{
            fontSize: "22px",
            color: "#a1a1aa",
            marginTop: "28px",
            textAlign: "center",
          }}
        >
          Seven generations from South Wales and London to Chile
        </div>

        {/* Accent line */}
        <div
          style={{
            width: "60px",
            height: "2px",
            backgroundColor: "#0284c7",
            marginTop: "36px",
            borderRadius: "1px",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
