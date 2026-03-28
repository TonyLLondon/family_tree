"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Scrollama, Step } from "react-scrollama";
import gsap from "gsap";
import Link from "next/link";
import type { BloodlineData, BloodlineNode } from "@/lib/bloodlines";
import { SiteNav } from "./SiteNav";

interface Props {
  data: BloodlineData;
}

function PersonCard({
  node,
  color,
  side,
}: {
  node: BloodlineNode;
  color: string;
  side: "left" | "right";
}) {
  const name = node.person.displayName;
  const yearStr = node.year
    ? node.deathYear
      ? `${node.year} – ${node.deathYear}`
      : `b. ${node.year}`
    : "";

  const inner = (
    <div
      className="group flex flex-col items-center gap-2 rounded-xl bg-white/92 px-3 py-4 shadow-xl ring-1 ring-black/5 backdrop-blur-sm transition-all hover:bg-white hover:shadow-2xl sm:flex-row sm:items-center sm:gap-3.5 sm:px-4 sm:py-3.5 md:gap-4 md:px-5 md:py-4"
      style={{
        borderLeft: side === "left" ? `3px solid ${color}` : undefined,
        borderRight: side === "right" ? `3px solid ${color}` : undefined,
      }}
    >
      {node.photo ? (
        <div className="h-20 w-20 flex-none rounded-full ring-2 ring-white shadow overflow-hidden md:h-24 md:w-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={node.photo.url}
            alt={name}
            className="h-full w-full object-cover"
            style={(() => {
              const focal = node.photo!.focal ?? [0.5, 0.5] as [number, number];
              const zoom = node.photo!.zoom ?? 1;
              if (zoom <= 1) {
                return { objectPosition: `${Math.round(focal[0] * 100)}% ${Math.round(focal[1] * 100)}%` };
              }
              const dx = 50 - focal[0] * 100;
              const dy = 50 - focal[1] * 100;
              return {
                objectPosition: `${Math.round(focal[0] * 100)}% ${Math.round(focal[1] * 100)}%`,
                transform: `scale(${zoom}) translate(${dx.toFixed(1)}%, ${dy.toFixed(1)}%)`,
                transformOrigin: "50% 50%",
              };
            })()}
            draggable={false}
          />
        </div>
      ) : (
        <div
          className="flex h-20 w-20 flex-none items-center justify-center rounded-full text-lg font-bold text-white shadow md:h-24 md:w-24 md:text-xl"
          style={{ backgroundColor: color }}
        >
          {name
            .split(" ")
            .filter((w) => w.length > 1 && w[0] === w[0].toUpperCase())
            .slice(0, 2)
            .map((w) => w[0])
            .join("")}
        </div>
      )}
      <div className="min-w-0 text-center sm:flex-1 sm:text-left">
        <p className="wrap-break-word text-sm font-semibold leading-snug text-zinc-900 sm:text-base">
          {name}
        </p>
        {yearStr && (
          <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
            {yearStr}
          </p>
        )}
        {node.role && (
          <p className="mt-0.5 wrap-break-word text-[11px] leading-snug text-zinc-400 italic sm:text-xs">
            {node.role}
          </p>
        )}
        {node.places && (
          <div className="mt-1.5 flex justify-center sm:justify-start">
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600 sm:text-xs">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-none text-zinc-400"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {node.places}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (node.slug) {
    return (
      <Link href={`/people/${node.slug}`} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function EmptySlot({ lineLabel }: { lineLabel: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-white/20 px-3 py-8 sm:py-10">
      <p className="text-center text-[11px] text-white/30 italic sm:text-xs">
        {lineLabel} line ends
      </p>
    </div>
  );
}

export function BloodlineChart({ data }: Props) {
  const { steps, stumpColor, addobbatiColor, totalGenerations, earliestYear, latestYear } = data;
  const [activeStep, setActiveStep] = useState(-1);
  const [heroVisible, setHeroVisible] = useState(true);
  const leftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fullRefs = useRef<(HTMLDivElement | null)[]>([]);
  const kenBurnsRefs = useRef<gsap.core.Tween[]>([]);

  const handleStepEnter = useCallback(
    ({ data: stepIndex }: { data: number }) => {
      setActiveStep(stepIndex);
      setHeroVisible(false);
    },
    [],
  );

  const handleStepExit = useCallback(
    ({
      data: stepIndex,
      direction,
    }: {
      data: number;
      direction: "up" | "down";
    }) => {
      if (stepIndex !== 0 || direction !== "up") return;
      setHeroVisible(true);
      setActiveStep(-1);
    },
    [],
  );

  useEffect(() => {
    const idx = activeStep < 0 ? 0 : Math.min(activeStep, steps.length - 1);
    const tweens: gsap.core.Tween[] = [];

    [leftRefs, rightRefs, fullRefs].forEach((refs) => {
      refs.current.forEach((el, i) => {
        if (!el) return;
        tweens.push(
          gsap.to(el, { opacity: i === idx ? 1 : 0, duration: 1.2, ease: "power2.inOut" }),
        );
      });
    });

    kenBurnsRefs.current.forEach((t) => t.kill());
    kenBurnsRefs.current = [];

    [leftRefs, rightRefs, fullRefs].forEach((refs) => {
      const activeEl = refs.current[idx];
      if (activeEl) {
        const img = activeEl.querySelector("img");
        if (img) {
          gsap.set(img, { scale: 1 });
          kenBurnsRefs.current.push(
            gsap.to(img, { scale: 1.08, duration: 25, ease: "none" }),
          );
        }
      }
    });

    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, [activeStep, steps.length]);

  const currentStep = steps[Math.max(0, Math.min(activeStep, steps.length - 1))];

  return (
    <>
      <SiteNav />

      <div className="relative bg-zinc-950">
        {/* Sticky full-viewport background */}
        <div className="sticky top-0 z-0 h-screen w-full overflow-hidden">
          {/* Full-width layers (for steps where both lines are in the same place) */}
          {steps.map((step, i) =>
            step.fullBg ? (
              <div
                key={`f${i}`}
                ref={(el) => {
                  fullRefs.current[i] = el;
                }}
                className="absolute inset-0"
                style={{ opacity: i === 0 ? 1 : 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/files/${step.fullBg.src}`}
                  alt={step.fullBg.alt}
                  className="h-full w-full object-cover"
                  style={
                    step.fullBg.focal
                      ? {
                          objectPosition: `${Math.round(step.fullBg.focal[0] * 100)}% ${Math.round(step.fullBg.focal[1] * 100)}%`,
                        }
                      : undefined
                  }
                  draggable={false}
                />
              </div>
            ) : (
              <div
                key={`f${i}`}
                ref={(el) => {
                  fullRefs.current[i] = el;
                }}
                className="absolute inset-0"
                style={{ opacity: 0 }}
              />
            ),
          )}

          {/* Left half — Stump region */}
          <div className="absolute top-0 left-0 bottom-0 w-1/2 overflow-hidden">
            {steps.map((step, i) => (
              <div
                key={`l${i}`}
                ref={(el) => {
                  leftRefs.current[i] = el;
                }}
                className="absolute inset-0"
                style={{ opacity: i === 0 && !step.fullBg ? 1 : 0 }}
              >
                {step.leftBg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/files/${step.leftBg.src}`}
                    alt={step.leftBg.alt}
                    className="h-full w-full object-cover"
                    style={
                      step.leftBg.focal
                        ? {
                            objectPosition: `${Math.round(step.leftBg.focal[0] * 100)}% ${Math.round(step.leftBg.focal[1] * 100)}%`,
                          }
                        : undefined
                    }
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Right half — Addobbati region */}
          <div className="absolute top-0 right-0 bottom-0 w-1/2 overflow-hidden">
            {steps.map((step, i) => (
              <div
                key={`r${i}`}
                ref={(el) => {
                  rightRefs.current[i] = el;
                }}
                className="absolute inset-0"
                style={{ opacity: i === 0 && !step.fullBg ? 1 : 0 }}
              >
                {step.rightBg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/files/${step.rightBg.src}`}
                    alt={step.rightBg.alt}
                    className="h-full w-full object-cover"
                    style={
                      step.rightBg.focal
                        ? {
                            objectPosition: `${Math.round(step.rightBg.focal[0] * 100)}% ${Math.round(step.rightBg.focal[1] * 100)}%`,
                          }
                        : undefined
                    }
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/60" />

          {/* Center seam (hidden when full-width bg active) */}
          {currentStep && !currentStep.fullBg && (
            <div className="absolute top-0 bottom-0 left-1/2 z-1 w-px -translate-x-1/2 bg-black/40" />
          )}

          {/* Captions */}
          {!heroVisible && currentStep?.fullBg?.caption && (
            <div
              className="absolute bottom-5 right-5 z-10 max-w-xs rounded-lg bg-black/50 px-3.5 py-2 text-xs leading-relaxed text-white/70 backdrop-blur-sm"
              style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))", right: "max(1.25rem, env(safe-area-inset-right))" }}
            >
              {currentStep.fullBg.caption}
            </div>
          )}
          {!heroVisible && !currentStep?.fullBg && currentStep?.leftBg?.caption && (
            <div
              className="absolute bottom-5 left-5 z-10 max-w-[22%] rounded-lg bg-black/50 px-3 py-1.5 text-[11px] leading-relaxed text-white/70 backdrop-blur-sm"
              style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))", left: "max(1.25rem, env(safe-area-inset-left))" }}
            >
              {currentStep.leftBg.caption}
            </div>
          )}
          {!heroVisible && !currentStep?.fullBg && currentStep?.rightBg?.caption && (
            <div
              className="absolute bottom-5 right-5 z-10 max-w-[22%] rounded-lg bg-black/50 px-3 py-1.5 text-[11px] leading-relaxed text-white/70 backdrop-blur-sm"
              style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))", right: "max(1.25rem, env(safe-area-inset-right))" }}
            >
              {currentStep.rightBg.caption}
            </div>
          )}

          {/* Vertical line guides */}
          <div className="pointer-events-none absolute inset-0 z-1 flex items-stretch justify-center">
            <div className="flex w-full max-w-4xl items-stretch">
              <div className="flex flex-1 justify-center">
                <div className="w-px" style={{ backgroundColor: `${stumpColor}33` }} />
              </div>
              <div className="w-20" />
              <div className="flex flex-1 justify-center">
                <div className="w-px" style={{ backgroundColor: `${addobbatiColor}33` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Scrolling overlay */}
        <div className="relative z-10" style={{ marginTop: "-100vh" }}>
          {/* Hero */}
          <div
            className="flex h-screen flex-col items-center justify-center px-6 text-center"
            style={{
              opacity: heroVisible ? 1 : 0,
              transition: "opacity 0.6s ease",
              pointerEvents: heroVisible ? "auto" : "none",
            }}
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/50 md:text-sm">
              {totalGenerations} generations · {earliestYear}–{latestYear}
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
              Bloodlines
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
              From Archer &amp; Sloan, backward through the centuries — two lineages converge: the{" "}
              <span style={{ color: stumpColor }} className="font-semibold">
                Stumps
              </span>{" "}
              of Swiss Thurgau and the{" "}
              <span style={{ color: addobbatiColor }} className="font-semibold">
                Addobbati
              </span>{" "}
              of Venetian Dalmatia
            </p>

            {/* Legend */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: stumpColor }}
                />
                <span className="text-white/50">Stump · Thurgau → Reval → Tehran → London</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: addobbatiColor }}
                />
                <span className="text-white/50">Addobbati · Bergamo → Zara → Florence</span>
              </div>
            </div>

            <div className="mt-14 animate-bounce text-white/30">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6,9 12,15 18,9" />
              </svg>
            </div>
          </div>

          {/* Steps */}
          <Scrollama
            onStepEnter={handleStepEnter}
            onStepExit={handleStepExit}
            offset={0.45}
          >
            {steps.map((step, i) => (
              <Step key={i} data={i}>
                <div className="px-3 py-[18vh] first:pt-[5vh] last:pb-[35vh] sm:px-4 md:px-6">
                  <div className="mx-auto max-w-4xl">
                    {/* Era label */}
                    <div className="mb-4 text-center">
                      <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 backdrop-blur-sm">
                        {step.era}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 sm:gap-2 md:gap-6">
                      {/* Stump (left) */}
                      <div className="min-w-0 flex-1">
                        {step.stump ? (
                          <PersonCard
                            node={step.stump}
                            color={stumpColor}
                            side="left"
                          />
                        ) : (
                          <EmptySlot lineLabel="Stump" />
                        )}
                      </div>

                      {/* Center connector dot */}
                      <div className="flex w-4 shrink-0 flex-col items-center justify-center md:w-auto md:pt-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-white/30 ring-2 ring-white/10" />
                      </div>

                      {/* Addobbati (right) */}
                      <div className="min-w-0 flex-1">
                        {step.addobbati ? (
                          <PersonCard
                            node={step.addobbati}
                            color={addobbatiColor}
                            side="right"
                          />
                        ) : (
                          <EmptySlot lineLabel="Addobbati" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Step>
            ))}
          </Scrollama>
        </div>
      </div>

      <footer className="border-t border-zinc-800 bg-zinc-950 py-8 text-center">
        <p className="font-serif text-sm text-zinc-600">
          Lewis · Stump · Addobbati · Zerauschek
        </p>
      </footer>
    </>
  );
}
