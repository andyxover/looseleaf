"use client";

// A month divider with a physical presence: the rule bar stays editorial and
// quiet, while a giant ghost-outline month name drifts behind it at a slower
// rate than the page — deep parallax that makes the archive feel layered.

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

import { FadeIn } from "@/components/Reveal";

export function MonthHeader({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["4%", "-10%"]);
  const ghost = label.split(" ")[0]; // "MAY 2026" → "MAY"

  return (
    <div ref={ref} className="relative">
      {!reduced && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[-2rem] -top-14 h-40 select-none overflow-hidden sm:-top-20 sm:h-56"
        >
          <motion.div
            style={{ x }}
            className="ghost-stroke whitespace-nowrap font-serif text-[8rem] font-black leading-none tracking-[-0.03em] sm:text-[13rem]"
          >
            {ghost}
          </motion.div>
        </div>
      )}
      <FadeIn>
        <div className="relative mt-20 mb-6 flex items-baseline justify-between border-t-2 border-zinc-900 pt-4 dark:border-zinc-100">
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-700 dark:text-zinc-300">
            {label}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
            {count.toString().padStart(2, "0")} {count === 1 ? "Entry" : "Entries"}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
