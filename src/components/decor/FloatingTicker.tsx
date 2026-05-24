"use client";

import { motion, useReducedMotion } from "motion/react";

export function FloatingTicker({ text }: { text: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-400 dark:text-zinc-600"
      animate={
        reduced ? undefined : { y: [0, -4, 0, 4, 0], opacity: [0.7, 1, 0.7] }
      }
      transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
    >
      {text}
    </motion.div>
  );
}
