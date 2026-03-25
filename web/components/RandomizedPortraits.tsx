"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type PortraitEntry = {
  id: string;
  name: string;
  photo: string;
  slug: string;
  objectPosition?: string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DISPLAY_COUNT = 8;

export function RandomizedPortraits({ portraits }: { portraits: PortraitEntry[] }) {
  const [selected, setSelected] = useState<PortraitEntry[]>([]);

  useEffect(() => {
    setSelected(shuffle(portraits).slice(0, DISPLAY_COUNT));
  }, [portraits]);

  if (selected.length === 0) return null;

  return (
    <section className="border-b border-zinc-100 bg-zinc-50/50 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Portraits from the archive
        </h2>
        <div className="flex gap-5 overflow-x-auto pb-2">
          {selected.map((f) => (
            <Link key={f.id} href={`/people/${f.slug}`} className="group flex-none">
              <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-white shadow-md transition group-hover:shadow-lg group-hover:ring-2 group-hover:ring-sky-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.photo}
                  alt={f.name}
                  className="h-full w-full object-cover"
                  style={f.objectPosition ? { objectPosition: f.objectPosition } : undefined}
                />
              </div>
              <p className="mt-2 max-w-28 text-center text-xs font-medium leading-tight text-zinc-700 group-hover:text-sky-700">
                {f.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
