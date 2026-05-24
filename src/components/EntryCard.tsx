"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { PhotoImage } from "@/components/PhotoImage";

type EntryCardProps = {
  id: string;
  title: string;
  createdAt: Date;
  cover?: string | null;
  index: number;
  featured?: boolean;
};

export function EntryCard({
  id,
  title,
  createdAt,
  cover,
  index,
  featured = false,
}: EntryCardProps) {
  const reduced = useReducedMotion();
  const delay = reduced ? 0 : Math.min(index, 8) * 0.06;
  const date = createdAt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={featured ? "" : "group"}
    >
      <Link href={`/journal/${id}`} className="block">
        <div
          className={`relative overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 ${
            featured ? "aspect-[16/10]" : "aspect-[4/5]"
          }`}
        >
          {cover && (
            <motion.div
              className="absolute inset-0"
              whileHover={reduced ? undefined : { scale: 1.04 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <PhotoImage
                src={cover}
                alt={title}
                fill
                className="object-cover"
                sizes={
                  featured
                    ? "(min-width: 1024px) 960px, 100vw"
                    : "(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                }
              />
            </motion.div>
          )}
          {featured && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-8 text-white sm:p-10">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] opacity-70">
                  Latest · {date}
                </div>
                <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-5xl">
                  {title}
                </h2>
              </div>
            </>
          )}
        </div>
        {!featured && (
          <div className="mt-4">
            <time className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {date}
            </time>
            <h2 className="mt-1.5 font-serif text-xl leading-snug tracking-tight transition group-hover:text-zinc-500 dark:group-hover:text-zinc-400">
              {title}
            </h2>
          </div>
        )}
      </Link>
    </motion.article>
  );
}
