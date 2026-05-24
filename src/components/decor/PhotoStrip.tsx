"use client";

import { motion, useReducedMotion } from "motion/react";

import { PhotoImage } from "@/components/PhotoImage";

type StripPhoto = {
  filePath: string;
  width?: number | null;
  height?: number | null;
};

// Horizontal scrolling strip of photos — runs continuously, hover pauses.
// Uses three copies of the list so wrapping is seamless.
export function PhotoStrip({
  photos,
  duration = 70,
  height = 96,
}: {
  photos: StripPhoto[];
  duration?: number;
  height?: number;
}) {
  const reduced = useReducedMotion();
  if (photos.length === 0) return null;
  const tape = [...photos, ...photos, ...photos];

  return (
    <div className="group relative overflow-hidden border-y border-zinc-200 bg-zinc-50/50 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <motion.div
        className="flex w-max items-center gap-3 py-4 group-hover:[animation-play-state:paused]"
        animate={reduced ? undefined : { x: ["0%", "-33.333%"] }}
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        {tape.map((p, i) => {
          const aspect =
            p.width && p.height ? p.width / p.height : 4 / 3;
          const w = Math.max(80, Math.round(height * aspect));
          return (
            <div
              key={i}
              className="relative shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900"
              style={{ width: w, height }}
            >
              <PhotoImage
                src={p.filePath}
                alt=""
                fill
                sizes={`${w}px`}
                className="object-cover"
              />
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
