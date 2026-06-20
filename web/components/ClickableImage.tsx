"use client";

import { useLightbox, LightboxOverlay } from "@/components/Lightbox";

export function ClickableImage({
  src,
  alt,
  className,
  style,
  focal,
  zoom,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** When set, render a face crop (same math as the chart avatar) instead of the full image. */
  focal?: [number, number];
  zoom?: number;
}) {
  const lightbox = useLightbox();

  if (focal) {
    const z = zoom ?? 1;
    return (
      <>
        <LightboxOverlay src={lightbox.src} alt={lightbox.alt} onClose={lightbox.close} />
        <div
          role="button"
          tabIndex={0}
          aria-label={alt}
          className={`cursor-zoom-in transition hover:shadow-lg ${className ?? ""}`}
          style={{
            backgroundImage: `url("${src}")`,
            backgroundSize: z > 1 ? `${Math.round(z * 100)}%` : "cover",
            backgroundPosition: `${Math.round(focal[0] * 100)}% ${Math.round(focal[1] * 100)}%`,
            backgroundRepeat: "no-repeat",
            ...style,
          }}
          onClick={() => lightbox.open(src, alt ?? "")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              lightbox.open(src, alt ?? "");
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <LightboxOverlay src={lightbox.src} alt={lightbox.alt} onClose={lightbox.close} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        className={`cursor-zoom-in transition hover:shadow-lg ${className ?? ""}`}
        style={style}
        onClick={() => lightbox.open(src, alt ?? "")}
      />
    </>
  );
}
