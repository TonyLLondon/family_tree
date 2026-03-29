"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const WHEEL_ZOOM_FACTOR = 0.002;
const DOUBLE_CLICK_SCALE = 3;

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
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
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });
  const pinchState = useRef<{ dist: number } | null>(null);
  const scaleRef = useRef(scale);
  const translateRef = useRef(translate);

  scaleRef.current = scale;
  translateRef.current = translate;

  const resetTransform = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleClose = useCallback(() => {
    resetTransform();
    onClose();
  }, [onClose, resetTransform]);

  useEffect(() => {
    if (!src) return;
    resetTransform();
  }, [src, resetTransform]);

  // Wheel zoom — zoom toward cursor position
  useEffect(() => {
    const container = containerRef.current;
    if (!src || !container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const img = imgRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;

      const oldScale = scaleRef.current;
      const delta = -e.deltaY * WHEEL_ZOOM_FACTOR;
      const newScale = clamp(oldScale * (1 + delta), MIN_SCALE, MAX_SCALE);
      const ratio = newScale / oldScale;

      const oldT = translateRef.current;
      const nx = cursorX - ratio * (cursorX - oldT.x);
      const ny = cursorY - ratio * (cursorY - oldT.y);

      setScale(newScale);
      setTranslate(newScale <= 1 ? { x: 0, y: 0 } : { x: nx, y: ny });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [src]);

  // Pointer drag (mouse and single-touch pan)
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (scaleRef.current <= 1) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
    },
    [],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    const dx = e.clientX - ds.lastX;
    const dy = e.clientY - ds.lastY;
    ds.lastX = e.clientX;
    ds.lastY = e.clientY;
    setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current.dragging = false;
  }, []);

  // Pinch-to-zoom (touch)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = { dist: Math.hypot(dx, dy) };
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchState.current.dist;
      pinchState.current.dist = newDist;

      setScale((prev) => clamp(prev * ratio, MIN_SCALE, MAX_SCALE));
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    pinchState.current = null;
    if (scaleRef.current <= 1) setTranslate({ x: 0, y: 0 });
  }, []);

  // Double-click to toggle zoom
  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;

    if (scaleRef.current > 1) {
      resetTransform();
    } else {
      const rect = img.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;
      const ratio = DOUBLE_CLICK_SCALE;
      const nx = cursorX - ratio * cursorX;
      const ny = cursorY - ratio * cursorY;
      setScale(DOUBLE_CLICK_SCALE);
      setTranslate({ x: nx, y: ny });
    }
  }, [resetTransform]);

  if (!src) return null;

  const isZoomed = scale > 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={isZoomed ? undefined : handleClose}
      style={{ touchAction: "none" }}
    >
      <button
        onClick={handleClose}
        className="absolute z-10 rounded-full bg-white/20 p-2.5 text-white transition hover:bg-white/40 active:bg-white/50"
        style={{
          right: "max(1rem, env(safe-area-inset-right))",
          top: "max(1rem, env(safe-area-inset-top))",
        }}
        aria-label="Close"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {isZoomed && (
        <button
          onClick={(e) => { e.stopPropagation(); resetTransform(); }}
          className="absolute z-10 rounded-full bg-white/20 p-2.5 text-white transition hover:bg-white/40 active:bg-white/50"
          style={{
            right: "max(1rem, env(safe-area-inset-right))",
            top: "max(4rem, calc(env(safe-area-inset-top) + 3rem))",
          }}
          aria-label="Reset zoom"
          title="Reset zoom"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="8" y1="11" x2="14" y2="11" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl select-none"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          cursor: isZoomed ? "grab" : "zoom-in",
          transition: dragState.current.dragging ? "none" : "transform 0.15s ease-out",
        }}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />

      {alt && !isZoomed && (
        <p
          className="absolute left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white/90"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {alt}
        </p>
      )}

      {!isZoomed && (
        <p className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/60"
          style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
        >
          Scroll or double-click to zoom
        </p>
      )}
    </div>
  );
}
