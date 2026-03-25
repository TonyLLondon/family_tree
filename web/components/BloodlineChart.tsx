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
  lineLabel: string;
}) {
  const name = node.person.displayName;
  const yearStr = node.year
    ? node.deathYear
      ? `${node.year} – ${node.deathYear}`
      : `b. ${node.year}`
    : "";

  const inner = (
    <div
      className="group flex items-center gap-3.5 rounded-xl bg-white/92 px-4 py-3.5 shadow-xl ring-1 ring-black/5 backdrop-blur-sm transition-all hover:bg-white hover:shadow-2xl"
      style={{
        borderLeft: side === "left" ? `3px solid ${color}` : undefined,
        borderRight: side === "right" ? `3px solid ${color}` : undefined,
      }}
    >
      {node.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={node.photo.url}
          alt={name}
          className="h-12 w-12 flex-none rounded-full object-cover ring-2 ring-white shadow"
          style={{
            objectPosition: node.photo.focal
              ? `${Math.round(node.photo.focal[0] * 100)}% ${Math.round(node.photo.focal[1] * 100)}%`
              : undefined,
          }}
          draggable={false}
        />
      ) : (
        <div
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-sm font-bold text-white shadow"
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
        {yearStr && <p className="text-xs text-zinc-500">{yearStr}</p>}
        {node.role && (
          <p className="mt-0.5 truncate text-[11px] leading-tight text-zinc-400 italic">
            {node.role}
          </p>
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

function EmptySlot({ lineLabel }: { side: "left" | "right"; lineLabel: string }) {
  return (
    <div className="flex h-[76px] items-center justify-center rounded-xl border border-dashed border-white/20 px-4">
      <p className="text-xs text-white/30 italic">{lineLabel} line ends</p>
    </div>
  );
}

export function BloodlineChart({ data }: Props) {
  const { steps, stumpColor, addobbatiColor } = data;
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
            <div className="absolute bottom-5 right-5 z-10 max-w-xs rounded-lg bg-black/50 px-3.5 py-2 text-xs leading-relaxed text-white/70 backdrop-blur-sm">
              {currentStep.fullBg.caption}
            </div>
          )}
          {!heroVisible && !currentStep?.fullBg && currentStep?.leftBg?.caption && (
            <div className="absolute bottom-5 left-5 z-10 max-w-[22%] rounded-lg bg-black/50 px-3 py-1.5 text-[11px] leading-relaxed text-white/70 backdrop-blur-sm">
              {currentStep.leftBg.caption}
            </div>
          )}
          {!heroVisible && !currentStep?.fullBg && currentStep?.rightBg?.caption && (
            <div className="absolute bottom-5 right-5 z-10 max-w-[22%] rounded-lg bg-black/50 px-3 py-1.5 text-[11px] leading-relaxed text-white/70 backdrop-blur-sm">
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
              1495 – present
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
              Bloodlines
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
              Two lineages traced back through the centuries — the{" "}
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
            <div className="mt-10 flex items-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: stumpColor }}
                />
                <span className="text-white/50">Stump · Thurgau → Tehran</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: addobbatiColor }}
                />
                <span className="text-white/50">Addobbati · Bergamo → Zara</span>
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
          <Scrollama onStepEnter={handleStepEnter} offset={0.45}>
            {steps.map((step, i) => (
              <Step key={i} data={i}>
                <div className="px-4 py-[18vh] first:pt-[5vh] last:pb-[35vh] md:px-6">
                  <div className="mx-auto max-w-4xl">
                    {/* Era label */}
                    <div className="mb-4 text-center">
                      <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 backdrop-blur-sm">
                        {step.era}
                      </span>
                    </div>

                    {/* Two columns */}
                    <div className="flex items-start gap-4 md:gap-6">
                      {/* Stump (left) */}
                      <div className="min-w-0 flex-1">
                        {step.stump ? (
                          <PersonCard
                            node={step.stump}
                            color={stumpColor}
                            side="left"
                            lineLabel="Stump"
                          />
                        ) : (
                          <EmptySlot side="left" lineLabel="Stump" />
                        )}
                      </div>

                      {/* Center connector dot */}
                      <div className="flex flex-col items-center justify-center pt-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-white/30 ring-2 ring-white/10" />
                      </div>

                      {/* Addobbati (right) */}
                      <div className="min-w-0 flex-1">
                        {step.addobbati ? (
                          <PersonCard
                            node={step.addobbati}
                            color={addobbatiColor}
                            side="right"
                            lineLabel="Addobbati"
                          />
                        ) : (
                          <EmptySlot side="right" lineLabel="Addobbati" />
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
