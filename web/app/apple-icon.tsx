import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f4f4f5",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <line
            x1="16" y1="29" x2="16" y2="18"
            stroke="#075985" strokeWidth="3" strokeLinecap="round"
          />
          <line
            x1="16" y1="18" x2="10" y2="12"
            stroke="#0369a1" strokeWidth="2.5" strokeLinecap="round"
          />
          <line
            x1="16" y1="18" x2="22" y2="12"
            stroke="#0369a1" strokeWidth="2.5" strokeLinecap="round"
          />
          <line
            x1="10" y1="12" x2="6" y2="6"
            stroke="#0284c7" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="10" y1="12" x2="14" y2="6"
            stroke="#0284c7" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="22" y1="12" x2="18" y2="6"
            stroke="#0284c7" strokeWidth="2" strokeLinecap="round"
          />
          <line
            x1="22" y1="12" x2="26" y2="6"
            stroke="#0284c7" strokeWidth="2" strokeLinecap="round"
          />
          <circle cx="6" cy="5" r="2.2" fill="#0ea5e9" />
          <circle cx="14" cy="5" r="2.2" fill="#0ea5e9" />
          <circle cx="18" cy="5" r="2.2" fill="#0ea5e9" />
          <circle cx="26" cy="5" r="2.2" fill="#0ea5e9" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
