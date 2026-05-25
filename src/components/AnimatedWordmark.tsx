"use client";

import { motion, useReducedMotion } from "motion/react";

const WORD = "Looseleaf";

// The Looseleaf wordmark, alive: each letter springs up on load, then keeps a
// gentle continuous bob (offset per letter so it reads as a wave), lifts and
// wiggles on hover, and the accent period bounces on its own. Honors
// prefers-reduced-motion with a static render.
export function AnimatedWordmark({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const letters = WORD.split("");

  if (reduced) {
    return (
      <span className={className}>
        {WORD}
        <span className="text-accent">.</span>
      </span>
    );
  }

  return (
    <span className={className} aria-label={`${WORD}.`}>
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block will-change-transform"
          initial={{ y: 70, opacity: 0, rotate: -8 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.06 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{
            y: -14,
            scale: 1.08,
            rotate: i % 2 === 0 ? -6 : 6,
            transition: { type: "spring", stiffness: 380, damping: 9 },
          }}
        >
          {/* inner span carries the perpetual wave so it composes with the
              one-shot entrance and hover on the outer span */}
          <motion.span
            className="inline-block"
            animate={{ y: [0, -7, 0] }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.16 * i,
            }}
          >
            {ch}
          </motion.span>
        </motion.span>
      ))}
      <motion.span
        aria-hidden
        className="inline-block text-accent"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, y: [0, -12, 0] }}
        transition={{
          scale: { delay: 0.06 * letters.length, type: "spring", stiffness: 500, damping: 8 },
          opacity: { delay: 0.06 * letters.length, duration: 0.3 },
          y: { duration: 1.7, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
        }}
        whileHover={{ scale: 1.6, transition: { type: "spring", stiffness: 400, damping: 8 } }}
      >
        .
      </motion.span>
    </span>
  );
}
