"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import type { FeedEntry } from "@/lib/feed";
import { PhotoImage } from "@/components/PhotoImage";

type Size = "s" | "m" | "l" | "wide";

// Deterministic-ish bento rhythm. Cycles through sizes so the layout looks
// designed rather than random. For each block of 6 entries:
//   [L, S, S, Wide, S, M]
// then repeat.
const PATTERN: Size[] = ["l", "s", "s", "wide", "s", "m"];

function classFor(size: Size): string {
  switch (size) {
    case "l":
      return "col-span-2 row-span-2 aspect-square";
    case "m":
      return "col-span-2 aspect-[3/2]";
    case "wide":
      return "col-span-3 sm:col-span-4 aspect-[3/1]";
    case "s":
    default:
      return "col-span-2 sm:col-span-1 aspect-square";
  }
}

function titleClassFor(size: Size): string {
  switch (size) {
    case "l":
      return "text-2xl sm:text-3xl";
    case "m":
      return "text-xl sm:text-2xl";
    case "wide":
      return "text-2xl sm:text-3xl";
    case "s":
    default:
      return "text-base sm:text-lg";
  }
}

export function BentoMosaic({ entries }: { entries: FeedEntry[] }) {
  const reduced = useReducedMotion();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [grid-auto-flow:dense]">
      {entries.map((entry, i) => {
        const size = PATTERN[i % PATTERN.length];
        const dateLabel = new Date(entry.date)
          .toLocaleDateString("en-US", { month: "short", day: "numeric" })
          .toUpperCase();
        return (
          <motion.article
            key={entry.id}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.6, delay: Math.min(i, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className={`group relative overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 ${classFor(size)}`}
          >
            <Link href={`/journal/${entry.id}`} className="absolute inset-0">
              {entry.cover && (
                <PhotoImage
                  src={entry.cover}
                  alt={entry.title}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-105"
                  sizes={
                    size === "l" || size === "wide"
                      ? "(min-width: 1024px) 640px, 100vw"
                      : "(min-width: 1024px) 320px, 50vw"
                  }
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.25em] opacity-70">
                  {dateLabel}
                </div>
                <h3
                  className={`font-serif leading-tight tracking-tight ${titleClassFor(size)}`}
                >
                  {entry.title}
                </h3>
                {(size === "l" || size === "wide" || size === "m") &&
                  entry.intro && (
                    <p className="mt-2 line-clamp-2 text-sm opacity-90">
                      {entry.intro}
                    </p>
                  )}
              </div>
            </Link>
          </motion.article>
        );
      })}
    </div>
  );
}
