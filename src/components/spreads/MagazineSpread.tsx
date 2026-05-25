"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import type { FeedEntry } from "@/lib/feed";
import { PhotoImage } from "@/components/PhotoImage";
import { MaskReveal } from "@/components/Reveal";

export function MagazineSpread({ entries }: { entries: FeedEntry[] }) {
  const reduced = useReducedMotion();
  return (
    <div className="space-y-16 sm:space-y-24">
      {entries.map((entry, i) => {
        const flipped = i % 2 === 1;
        const dateLabel = new Date(entry.date)
          .toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
          .toUpperCase();
        const entryNum = (i + 1).toString().padStart(2, "0");
        return (
          <motion.article
            key={entry.id}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="group relative"
          >
            <Link href={`/journal/${entry.id}`} className="block">
              <div className="grid gap-8 sm:grid-cols-12 sm:gap-12">
                <div
                  className={`relative overflow-hidden rounded-xl bg-zinc-100 aspect-[3/2] sm:col-span-7 sm:aspect-auto sm:min-h-[22rem] dark:bg-zinc-900 ${
                    flipped ? "sm:order-2" : ""
                  }`}
                >
                  {entry.cover && (
                    <PhotoImage
                      src={entry.cover}
                      alt={entry.title}
                      fill
                      className="object-cover transition duration-700 group-hover:scale-[1.03]"
                      sizes="(min-width: 1024px) 640px, 100vw"
                    />
                  )}
                </div>
                <div
                  className={`flex flex-col justify-center sm:col-span-5 ${
                    flipped ? "sm:order-1 sm:pr-2" : "sm:pl-2"
                  }`}
                >
                  <div className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                    <span className="text-accent">Entry № {entryNum}</span>
                    <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
                      ·
                    </span>
                    <span className="tracking-[0.25em] text-zinc-400">{dateLabel}</span>
                  </div>
                  <h3 className="mt-6 font-serif text-3xl leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
                    <MaskReveal onView duration={0.8}>
                      {entry.title}
                    </MaskReveal>
                  </h3>
                  {entry.intro && (
                    <p className="mt-5 max-w-prose text-base leading-7 text-zinc-600 dark:text-zinc-400">
                      {entry.intro}
                    </p>
                  )}
                  <div className="mt-8 inline-flex items-baseline gap-2 self-start border-b border-zinc-300 pb-1 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-700 transition group-hover:border-accent group-hover:text-accent dark:border-zinc-700 dark:text-zinc-300">
                    Read entry
                    <span aria-hidden>→</span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.article>
        );
      })}
    </div>
  );
}
