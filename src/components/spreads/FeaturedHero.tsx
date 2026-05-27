"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

import type { FeedEntry } from "@/lib/feed";
import { PhotoImage } from "@/components/PhotoImage";
import { EntryStats } from "@/components/spreads/EntryStats";

export function FeaturedHero({ entry }: { entry: FeedEntry }) {
  const reduced = useReducedMotion();
  const dateLabel = new Date(entry.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 220, damping: 24, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 220, damping: 24, mass: 0.5 });
  const rotateX = useTransform(sy, [0, 1], [4, -4]);
  const rotateY = useTransform(sx, [0, 1], [-4, 4]);

  function onMouseMove(e: React.MouseEvent) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }
  function onMouseLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <article className="relative">
      <Link href={`/journal/${entry.id}`} className="block">
        <motion.div
          ref={ref}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={
            reduced ? undefined : { rotateX, rotateY, transformPerspective: 1400 }
          }
          className="relative overflow-hidden rounded-xl bg-zinc-100 will-change-transform dark:bg-zinc-900 aspect-[16/10]"
        >
          {entry.cover && (
            <motion.div
              className="absolute inset-0"
              whileHover={reduced ? undefined : { scale: 1.04 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <PhotoImage
                src={entry.cover}
                alt={entry.title}
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 1100px, 100vw"
              />
            </motion.div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-8 text-white sm:p-12">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] opacity-70">
              Latest · {dateLabel}
            </div>
            <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-5xl">
              {entry.title}
            </h2>
            {entry.intro && (
              <p className="mt-4 max-w-xl text-base leading-7 opacity-90 sm:text-lg">
                {entry.intro}
              </p>
            )}
            <EntryStats
              likeCount={entry.likeCount}
              views={entry.views}
              className="mt-5 text-white/70"
            />
          </div>
        </motion.div>
      </Link>
    </article>
  );
}
