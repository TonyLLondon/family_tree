"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { runMermaidOnNode } from "@/lib/mermaidClient";

type Props = {
  chart: string;
};

const MIN_SCALE = 0.75;
const MAX_SCALE = 4;
const WHEEL_SENS = 0.001;

export function MermaidBlock({ chart }: Props) {
  const uid = useId().replace(/:/g, "");
  const preRef = useRef<HTMLPreElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const overlayHostRef = useRef<HTMLDivElement>(null);
  /** Start zoomed in so first paint is readable on dense flowcharts */
  const [scale, setScale] = useState(1.72);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const drag = useRef<{
    active: boolean;
    px: number;
    py: number;
    startTx: number;
    startTy: number;
    pointerId: number | null;
  }>({
    active: false,
    px: 0,
    py: 0,
    startTx: 0,
    startTy: 0,
    pointerId: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!preRef.current) return;
      try {
        await runMermaidOnNode(preRef.current);
      } catch {
        /* duplicate id on fast refresh */
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  const cloneIntoOverlay = useCallback(() => {
    const svg = preRef.current?.querySelector("svg");
    const host = overlayHostRef.current;
    if (!svg || !host) return;
    host.replaceChildren();
    host.appendChild(svg.cloneNode(true));
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const id = window.requestAnimationFrame(() => {
      cloneIntoOverlay();
    });
    setScale(1.72);
    setTx(0);
    setTy(0);
    return () => window.cancelAnimationFrame(id);
  }, [expanded, chart, cloneIntoOverlay]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const onWheelOverlay = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => {
      const next = s * (1 - e.deltaY * WHEEL_SENS);
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    });
  };

  const onPointerDownOverlay = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = drag.current;
    t.active = true;
    t.pointerId = e.pointerId;
    t.px = e.clientX;
    t.py = e.clientY;
    t.startTx = tx;
    t.startTy = ty;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMoveOverlay = (e: React.PointerEvent) => {
    const t = drag.current;
    if (!t.active || e.pointerId !== t.pointerId) return;
    const dx = e.clientX - t.px;
    const dy = e.clientY - t.py;
    setTx(t.startTx + dx);
    setTy(t.startTy + dy);
  };

  const onPointerUpOverlay = (e: React.PointerEvent) => {
    const t = drag.current;
    if (e.pointerId !== t.pointerId) return;
    t.active = false;
    t.pointerId = null;
  };

  const overlay =
    mounted &&
    expanded &&
    createPortal(
      <div
        className="fixed inset-0 z-100 flex flex-col bg-slate-900/55 p-3 backdrop-blur-sm md:p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Diagram zoom"
        onClick={(e) => {
          if (e.target === e.currentTarget) setExpanded(false);
        }}
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-sm text-slate-700">
            Wheel to zoom · drag to pan · Escape or dim area to close
          </p>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => setExpanded(false)}
          >
            Close
          </button>
        </div>
        <div
          className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner active:cursor-grabbing"
          onWheel={onWheelOverlay}
          onPointerDown={onPointerDownOverlay}
          onPointerMove={onPointerMoveOverlay}
          onPointerUp={onPointerUpOverlay}
          onPointerCancel={onPointerUpOverlay}
        >
          <div
            ref={overlayHostRef}
            className="pointer-events-none absolute left-1/2 top-1/2 [&_svg]:max-w-none"
            style={{
              transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`,
            }}
          />
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div className="not-prose my-8 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-600">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-600">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            Diagram
          </span>
          <button
            type="button"
            className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-600"
            onClick={() => setExpanded(true)}
          >
            Zoom view
          </button>
        </div>
        <div
          role="button"
          tabIndex={0}
          className="relative w-full cursor-zoom-in rounded-b-xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:ring-offset-zinc-900"
          aria-label="Open zoomable diagram"
          onClick={() => setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(true);
            }
          }}
        >
          <div className="flex max-h-[min(78vh,760px)] min-h-[400px] items-center justify-center overflow-auto p-4 md:p-8">
            <div className="origin-center rounded-lg border border-zinc-100 bg-white p-2 shadow-sm [&_svg]:max-w-none">
              <pre
                id={`mermaid-${uid}`}
                ref={preRef}
                className="mermaid !m-0 !bg-transparent !p-0 text-[16px] leading-snug"
              >
                {chart}
              </pre>
            </div>
          </div>
        </div>
      </div>
      {overlay}
    </>
  );
}
