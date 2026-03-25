"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Scrollama, Step } from "react-scrollama";
import gsap from "gsap";
import { MarkdownContent } from "./MarkdownContent";
import { SiteNav } from "./SiteNav";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScrollyMedia {
  src: string;
  alt: string;
  caption?: string;
}

interface ScrollyStepData {
  media: ScrollyMedia;
  era?: string;
}

interface MarkdownSection {
  heading: string;
  body: string;
}

interface Props {
  hero: { title: string; subtitle: string; era: string };
  sections: MarkdownSection[];
  steps: ScrollyStepData[];
  scrollyStepCount: number;
  filePath: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScrollytellingNarrative({
  hero,
  sections,
  steps,
  scrollyStepCount,
  filePath,
}: Props) {
  const [activeStep, setActiveStep] = useState(-1);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const kenBurnsRef = useRef<gsap.core.Tween | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);

  const handleStepEnter = useCallback(
    ({ data }: { data: number }) => {
      setActiveStep(data);
      setHeroVisible(false);
    },
    [],
  );

  // Crossfade images + Ken Burns on active image
  useEffect(() => {
    const idx = activeStep < 0 ? 0 : Math.min(activeStep, steps.length - 1);

    const tweens: gsap.core.Tween[] = [];
    imageRefs.current.forEach((el, i) => {
      if (!el) return;
      tweens.push(
        gsap.to(el, {
          opacity: i === idx ? 1 : 0,
          duration: 0.9,
          ease: "power2.inOut",
        }),
      );
    });

    if (kenBurnsRef.current) kenBurnsRef.current.kill();
    const activeEl = imageRefs.current[idx];
    if (activeEl) {
      const img = activeEl.querySelector("img");
      if (img) {
        gsap.set(img, { scale: 1 });
        kenBurnsRef.current = gsap.to(img, {
          scale: 1.08,
          duration: 20,
          ease: "none",
        });
      }
    }

    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, [activeStep, steps.length]);

  const scrollySections = sections.slice(0, scrollyStepCount);
  const appendixSections = sections.slice(scrollyStepCount);

  return (
    <>
      <SiteNav />

      {/* ── Scrollytelling area ─────────────────────────────────────────── */}
      <div className="relative bg-zinc-900">
        {/* Sticky full-viewport media panel */}
        <div className="sticky top-0 z-0 h-screen w-full overflow-hidden">
          {steps.map((step, i) => (
            <div
              key={i}
              ref={(el) => {
                imageRefs.current[i] = el;
              }}
              className="absolute inset-0"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.media.src}
                alt={step.media.alt}
                className="h-full w-full object-cover"
                draggable={false}
              />
              {/* gradient for text readability */}
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/40" />
            </div>
          ))}

          {/* Image caption */}
          <MediaCaption
            caption={steps[Math.max(0, Math.min(activeStep, steps.length - 1))]?.media.caption}
            visible={!heroVisible}
          />
        </div>

        {/* Scrolling overlay (text + hero) */}
        <div className="relative z-10" style={{ marginTop: "-100vh" }}>
          {/* ── Hero ──────────────────────────────────────────────────── */}
          <div
            className="flex h-screen flex-col items-center justify-center px-6 text-center"
            style={{
              opacity: heroVisible ? 1 : 0,
              transition: "opacity 0.6s ease",
              pointerEvents: heroVisible ? "auto" : "none",
            }}
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/60 md:text-sm">
              {hero.era}
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
              {hero.subtitle}
            </p>
            <div className="mt-14 animate-bounce text-white/40">
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

          {/* ── Scrollama steps ───────────────────────────────────────── */}
          <Scrollama onStepEnter={handleStepEnter} offset={0.45}>
            {scrollySections.map((section, i) => (
              <Step key={i} data={i}>
                <div className="px-4 py-[20vh] first:pt-[5vh] last:pb-[30vh] md:px-6">
                  <div className="mx-auto max-w-2xl overflow-hidden rounded-xl bg-white/94 shadow-2xl ring-1 ring-black/5 backdrop-blur-sm">
                    {/* Era ribbon */}
                    {steps[i]?.era && (
                      <div className="border-b border-zinc-200/60 bg-zinc-50/80 px-6 py-2.5 md:px-10">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                          {steps[i].era}
                        </span>
                      </div>
                    )}
                    <div className="px-6 py-6 md:px-10 md:py-8">
                      <h2 className="mb-5 text-xl font-bold tracking-tight text-zinc-900 md:text-2xl">
                        {section.heading}
                      </h2>
                      <MarkdownContent
                        content={section.body}
                        filePath={filePath}
                      />
                    </div>
                  </div>
                </div>
              </Step>
            ))}
          </Scrollama>
        </div>
      </div>

      {/* ── Appendix (corrections, links, etc.) ──────────────────────── */}
      {appendixSections.length > 0 && (
        <main className="mx-auto max-w-4xl flex-1 px-4 py-12 md:px-6">
          {appendixSections.map((section, i) => (
            <section
              key={`appendix-${i}`}
              className="mb-10 border-b border-zinc-100 pb-10 last:border-0"
            >
              <h2 className="mb-4 text-xl font-bold tracking-tight text-zinc-900">
                {section.heading}
              </h2>
              <MarkdownContent content={section.body} filePath={filePath} />
            </section>
          ))}
        </main>
      )}

      <footer className="border-t border-zinc-100 bg-zinc-50 py-6 text-center text-xs text-zinc-400">
        Family history archive — built from the vault
      </footer>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MediaCaption({
  caption,
  visible,
}: {
  caption: string | undefined;
  visible: boolean;
}) {
  if (!caption) return null;
  return (
    <div
      className="absolute bottom-5 right-5 z-10 max-w-xs rounded-lg bg-black/50 px-3.5 py-2 text-xs leading-relaxed text-white/80 backdrop-blur-sm transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {caption}
    </div>
  );
}
