"use client";

import { motion, useReducedMotion } from "motion/react";

type Variant = "warm" | "cool" | "neutral";

const palettes: Record<Variant, string> = {
  warm: "from-amber-200/40 via-rose-200/30 to-orange-200/25 dark:from-amber-400/15 dark:via-rose-500/10 dark:to-orange-400/10",
  cool: "from-sky-200/40 via-indigo-200/30 to-violet-200/25 dark:from-sky-400/15 dark:via-indigo-500/10 dark:to-violet-400/10",
  neutral:
    "from-zinc-200/40 via-zinc-300/25 to-stone-200/30 dark:from-zinc-400/12 dark:via-zinc-500/8 dark:to-stone-400/10",
};

export function AmbientOrb({
  size = 480,
  variant = "warm",
  className = "",
  duration = 18,
}: {
  size?: number;
  variant?: Variant;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full bg-gradient-to-br blur-3xl ${palettes[variant]} ${className}`}
      style={{ width: size, height: size }}
      animate={
        reduced
          ? undefined
          : {
              x: [0, 60, -40, 0],
              y: [0, -30, 40, 0],
              scale: [1, 1.08, 0.94, 1],
            }
      }
      transition={{
        duration,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      }}
    />
  );
}
