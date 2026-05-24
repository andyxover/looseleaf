"use client";

import { motion, useReducedMotion } from "motion/react";

export function WavyDivider({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className={`w-full ${className}`} aria-hidden>
      <svg
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        className="h-6 w-full text-zinc-300 dark:text-zinc-700"
      >
        <motion.path
          d="M0 20 Q 75 4 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={reduced ? undefined : { pathLength: 0, opacity: 0 }}
          whileInView={reduced ? undefined : { pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </div>
  );
}
