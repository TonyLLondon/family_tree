"use client";

import { useCallback, useEffect, useState } from "react";

export function useLightbox() {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  const open = useCallback((imgSrc: string, imgAlt?: string) => {
    setSrc(imgSrc);
    setAlt(imgAlt ?? "");
  }, []);

  const close = useCallback(() => setSrc(null), []);

  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [src, close]);

  return { src, alt, open, close };
}

export function LightboxOverlay({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
        aria-label="Close"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {alt && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white/90">
          {alt}
        </p>
      )}
    </div>
  );
}
