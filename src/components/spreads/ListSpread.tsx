"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import type { FeedEntry } from "@/lib/feed";
import { PhotoImage } from "@/components/PhotoImage";

export function ListSpread({ entries }: { entries: FeedEntry[] }) {
  const reduced = useReducedMotion();
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {entries.map((entry, i) => {
        const dateLabel = new Date(entry.date)
          .toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
          .toUpperCase();
        return (
          <motion.li
            key={entry.id}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -5% 0px" }}
            transition={{ duration: 0.5, delay: Math.min(i, 6) * 0.03, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href={`/journal/${entry.id}`}
              className="group flex items-start gap-5 py-5 transition hover:bg-zinc-50 dark:hover:bg-zinc-900 sm:gap-6"
            >
              <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 sm:w-32">
                {entry.cover && (
                  <PhotoImage
                    src={entry.cover}
                    alt={entry.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(min-width: 640px) 128px, 96px"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                  <span>{dateLabel}</span>
                  <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  <span className="text-zinc-400">
                    {entry.photoCount.toString().padStart(2, "0")} ph
                  </span>
                </div>
                <h3 className="font-serif text-xl leading-snug tracking-tight transition group-hover:text-zinc-500 dark:group-hover:text-zinc-400 sm:text-2xl">
                  {entry.title}
                </h3>
                {entry.intro && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400 sm:text-base">
                    {entry.intro}
                  </p>
                )}
              </div>
            </Link>
          </motion.li>
        );
      })}
    </ul>
  );
}
