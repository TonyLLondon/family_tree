import type { CSSProperties } from "react";

/**
 * Single source of truth for rendering a person's face photo as a cropped avatar.
 *
 * `focal` is a CSS `background-position` (0–1 per axis) and `zoom` enlarges via the
 * background width — exactly the values written by the dev focal editor (`/dev/focal`)
 * and stored in `web/photo-map.json`. Every avatar surface (pedigree + fan charts,
 * bloodline cards, archive portraits, person-page sidebar, editor preview) MUST use
 * this so they all frame faces identically.
 *
 * Returns only the background properties; the caller sets size / border-radius. Apply
 * to a `<div>` (not an `<img>`): an `<img object-cover>` cannot honour `zoom` with the
 * same math, which is what caused earlier surfaces to disagree.
 */
export function faceCropStyle(
  src: string,
  focal: [number, number] = [0.5, 0.5],
  zoom = 1,
): CSSProperties {
  const x = Math.round(clamp01(focal?.[0] ?? 0.5) * 100);
  const y = Math.round(clamp01(focal?.[1] ?? 0.5) * 100);
  return {
    backgroundImage: `url("${src}")`,
    backgroundSize: zoom > 1 ? `${Math.round(zoom * 100)}%` : "cover",
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: "no-repeat",
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}
