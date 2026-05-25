"use client";

import { motion, useReducedMotion } from "motion/react";
import { Asterisk } from "lucide-react";

export function Marquee({
  items = [
    "Photo journal",
    "Looseleaf",
    "Moments",
    "School",
    "Photos",
    "AI-laid out",
  ],
  duration = 32,
}: {
  items?: string[];
  duration?: number;
}) {
  const reduced = useReducedMotion();
  // Duplicate the list so the marquee can loop seamlessly.
  const tape = [...items, ...items, ...items];

  return (
    <div
      className="relative overflow-hidden border-y border-zinc-200 py-3 dark:border-zinc-800"
      aria-hidden
    >
      <motion.div
        className="flex w-max gap-10 whitespace-nowrap"
        animate={reduced ? undefined : { x: ["0%", "-33.333%"] }}
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        {tape.map((label, i) => (
          <div
            key={i}
            className="flex items-center gap-10 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500"
          >
            <span>{label}</span>
            <Asterisk className="size-3.5 text-accent" strokeWidth={1.5} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
