"use client";

import { useLightbox, LightboxOverlay } from "@/components/Lightbox";

export function ClickableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
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
        onClick={() => lightbox.open(src, alt ?? "")}
      />
    </>
  );
}
