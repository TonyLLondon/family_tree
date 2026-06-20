"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { faceCropStyle } from "@/lib/faceCrop";

export type FocalItem = {
  id: string;
  displayName: string;
  src: string;
  url: string;
  focal: [number, number];
  zoom: number;
};

type WorkItem = FocalItem & { dirty: boolean; saved: boolean };

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;

/** Mirror of the chart avatar background math so the preview matches the rendered card exactly. */
function avatarBgStyle(src: string, focal: [number, number], zoom: number): CSSProperties {
  return { width: "100%", height: "100%", ...faceCropStyle(src, focal, zoom) };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Per-axis display scale (displayed image size ÷ circle size) for the chart avatar, matching
 * `avatarBgStyle`: zoom > 1 sizes by width (height keeps aspect); zoom == 1 uses `cover`.
 * Returns [sx, sy]; a value of 1 means that axis exactly fills the square circle (position has no effect).
 */
function axisScales(zoom: number, natW: number, natH: number): [number, number] {
  if (!natW || !natH) return [1, 1];
  if (zoom > 1) return [zoom, zoom * (natH / natW)];
  const minDim = Math.min(natW, natH);
  return [natW / minDim, natH / minDim];
}

/** background-position fraction that centres image-fraction `f` in the circle, given axis scale `s`. */
function faceToPos(f: number, s: number): number {
  if (Math.abs(s - 1) < 1e-3) return 0.5;
  return clamp01((f * s - 0.5) / (s - 1));
}

/** Inverse of `faceToPos`: the image-fraction that ends up centred for background-position `p`. */
function posToFace(p: number, s: number): number {
  if (Math.abs(s - 1) < 1e-3) return 0.5;
  return clamp01((0.5 + p * (s - 1)) / s);
}

export function FocalEditor({ items: initial }: { items: FocalItem[] }) {
  const [items, setItems] = useState<WorkItem[]>(() =>
    initial.map((it) => ({ ...it, dirty: false, saved: false })),
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const draggingRef = useRef(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const naturalRef = useRef<{ w: number; h: number } | null>(null);

  const total = items.length;
  const current = items[index];

  const captureNatural = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.complete || !img.naturalWidth) return false;
    const dims = { w: img.naturalWidth, h: img.naturalHeight };
    naturalRef.current = dims;
    setNatural(dims);
    return true;
  }, []);

  /**
   * Read natural dimensions when the photo changes. The browser does NOT re-fire `onLoad` when two
   * adjacent people reuse the same image URL (e.g. a couple in one photo), so read directly from the
   * already-complete element here; `onLoad` only covers the not-yet-loaded case.
   */
  useEffect(() => {
    naturalRef.current = null;
    setNatural(null);
    captureNatural();
  }, [index, current.url, captureNatural]);

  const onImgLoad = useCallback(() => {
    captureNatural();
  }, [captureNatural]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        if (total === 0) return 0;
        return (i + delta + total) % total;
      });
      setError(null);
    },
    [total],
  );

  /** Place the face at image-fraction `f`; store the background-position that centres it at current zoom. */
  const placeFace = useCallback(
    (f: [number, number]) => {
      const nat = naturalRef.current ?? (captureNatural() ? naturalRef.current : null);
      if (!nat) return;
      setItems((prev) =>
        prev.map((it, i) => {
          if (i !== index) return it;
          const [sx, sy] = axisScales(it.zoom, nat.w, nat.h);
          const focal: [number, number] = [faceToPos(f[0], sx), faceToPos(f[1], sy)];
          return { ...it, focal, dirty: true, saved: false };
        }),
      );
    },
    [index, captureNatural],
  );

  /** Change zoom while keeping the same face centred (recompute background-position for the new scale). */
  const setZoom = useCallback(
    (zoom: number) => {
      const nat = naturalRef.current;
      setItems((prev) =>
        prev.map((it, i) => {
          if (i !== index) return it;
          if (!nat) return { ...it, zoom, dirty: true, saved: false };
          const [oldSx, oldSy] = axisScales(it.zoom, nat.w, nat.h);
          const face: [number, number] = [posToFace(it.focal[0], oldSx), posToFace(it.focal[1], oldSy)];
          const [sx, sy] = axisScales(zoom, nat.w, nat.h);
          const focal: [number, number] = [faceToPos(face[0], sx), faceToPos(face[1], sy)];
          return { ...it, zoom, focal, dirty: true, saved: false };
        }),
      );
    },
    [index],
  );

  const faceFromEvent = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return [clamp01((clientX - rect.left) / rect.width), clamp01((clientY - rect.top) / rect.height)];
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const f = faceFromEvent(e.clientX, e.clientY);
      if (f) placeFace(f);
    },
    [faceFromEvent, placeFace],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const f = faceFromEvent(e.clientX, e.clientY);
      if (f) placeFace(f);
    },
    [faceFromEvent, placeFace],
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const save = useCallback(
    async (advance: boolean) => {
      const it = items[index];
      if (!it) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/dev/focal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: it.id, src: it.src, focal: it.focal, zoom: it.zoom }),
        });
        if (!res.ok) throw new Error(await res.text());
        setItems((prev) =>
          prev.map((p, i) => (i === index ? { ...p, dirty: false, saved: true } : p)),
        );
        if (advance) go(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [items, index, go],
  );

  /** Auto-save: write the current edit to photo-map.json shortly after the last change, so a page
   * refresh re-reads saved work instead of losing it. Re-armed on every change (debounced). */
  useEffect(() => {
    const it = items[index];
    if (!it || !it.dirty) return;
    const t = setTimeout(() => {
      void save(false);
    }, 500);
    return () => clearTimeout(t);
  }, [items, index, save]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if ((e.key === "s" || e.key === "S") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void save(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        void save(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, save]);

  const dirtyCount = useMemo(() => items.filter((it) => it.dirty).length, [items]);

  if (total === 0) {
    return <p className="text-sm text-zinc-500">No portraits with photos found in photo-map.json.</p>;
  }

  const [sx, sy] = natural ? axisScales(current.zoom, natural.w, natural.h) : [1, 1];
  const fx = posToFace(current.focal[0], sx) * 100;
  const fy = posToFace(current.focal[1], sy) * 100;
  const xLocked = Math.abs(sx - 1) < 1e-3;
  const yLocked = Math.abs(sy - 1) < 1e-3;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-bold tracking-tight text-zinc-900">Face framing editor</h1>
          <p className="max-w-2xl text-xs text-zinc-500">
            Click or drag on the photo to place the face. The circle on the right is exactly how the chart avatar
            crops. Zoom tightens around that point. Changes auto-save to <span className="font-mono">photo-map.json</span>{" "}
            (so a refresh keeps your work). ← / → move between portraits, Enter jumps to the next.
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div className="font-mono text-sm text-zinc-800">
            {index + 1} / {total}
          </div>
          <div>{dirtyCount > 0 ? `${dirtyCount} unsaved` : "all saved"}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ← Prev
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold text-zinc-900" title={current.displayName}>
            {current.displayName}{" "}
            <span className="font-mono text-xs font-normal text-zinc-400">{current.id}</span>
          </div>
          <div className="truncate font-mono text-[11px] text-zinc-400" title={current.src}>
            {current.src}
          </div>
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-start justify-center rounded-lg border border-zinc-200 bg-zinc-100 p-2">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative inline-block cursor-crosshair touch-none select-none leading-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={current.url}
              alt={current.displayName}
              draggable={false}
              onLoad={onImgLoad}
              className="block max-h-[70vh] w-auto max-w-full"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: `${fx}%`,
                top: `${fy}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="h-6 w-6 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)]" />
              <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.7)]" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="text-xs font-medium text-zinc-500">Chart preview</div>
          <div className="h-28 w-28 overflow-hidden rounded-full shadow-md ring-1 ring-black/10">
            <div style={avatarBgStyle(current.url, current.focal, current.zoom)} />
          </div>
          <div className="h-12 w-12 overflow-hidden rounded-full shadow ring-1 ring-black/10">
            <div style={avatarBgStyle(current.url, current.focal, current.zoom)} />
          </div>
          <div className="text-[11px] text-zinc-400">card size · 48px</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 text-sm text-zinc-700">
          <span className="w-14 shrink-0 font-medium">Zoom</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.1}
            value={current.zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-10 shrink-0 text-right font-mono text-xs text-zinc-500">
            {current.zoom.toFixed(1)}×
          </span>
        </label>
        <div className="font-mono text-xs text-zinc-400">
          focal [{(current.focal[0]).toFixed(2)}, {(current.focal[1]).toFixed(2)}] · zoom {current.zoom.toFixed(2)}
        </div>
        {xLocked || yLocked ? (
          <div className="text-xs text-amber-700">
            At this zoom the {xLocked && yLocked ? "image fully fits" : xLocked ? "full width is shown" : "full height is shown"}
            , so the {xLocked && yLocked ? "point" : xLocked ? "horizontal" : "vertical"} position{" "}
            {xLocked && yLocked ? "has" : "can’t"} {xLocked && yLocked ? "no effect" : "be moved"}. Increase zoom to pan{" "}
            {xLocked && !yLocked ? "left/right" : !xLocked && yLocked ? "up/down" : "in both directions"}.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={busy}
          className="rounded-md border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={busy}
          className="rounded-md border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Save &amp; next →
        </button>
        {current.saved && !current.dirty ? (
          <span className="text-sm font-medium text-emerald-700">Saved</span>
        ) : current.dirty ? (
          <span className="text-sm font-medium text-amber-700">Unsaved changes</span>
        ) : null}
        {error ? <span className="text-sm font-medium text-red-700">{error}</span> : null}
      </div>
    </div>
  );
}
