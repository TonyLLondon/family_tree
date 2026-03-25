"use client";

import { useLightbox, LightboxOverlay } from "@/components/Lightbox";

export function ClickableImage({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const lightbox = useLightbox();

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
