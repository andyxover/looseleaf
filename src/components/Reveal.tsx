"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Editorial clip reveal: the content wipes up from behind a hard edge.
// Use for headings. `onView` waits for scroll-in; otherwise fires on mount.
// The bottom padding gives descenders (g, y, p) room so the clip doesn't
// shave them at rest.
export function MaskReveal({
  children,
  delay = 0,
  duration = 0.75,
  className,
  onView = false,
  pb = "0.18em",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  onView?: boolean;
  pb?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{children}</span>;
  // Observe the outer clip box (which sits in its normal layout position) and
  // let the variant cascade to the translated inner span — otherwise the
  // IntersectionObserver would watch the element pushed 115% off-screen and
  // never fire, leaving the heading clipped out of view forever.
  const variants = { hidden: { y: "115%" }, shown: { y: "0%" } };
  return (
    <motion.span
      className={`inline-block overflow-hidden align-bottom ${className ?? ""}`}
      style={{ paddingBottom: pb }}
      initial="hidden"
      {...(onView
        ? {
            whileInView: "shown",
            viewport: { once: true, margin: "0px 0px -12% 0px" },
          }
        : { animate: "shown" })}
    >
      <motion.span
        className="inline-block will-change-transform"
        variants={variants}
        transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 32,
  className,
  duration = 0.6,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Fires on mount, not on viewport entry — for above-the-fold elements that
// shouldn't wait to "reveal".
export function FadeIn({
  children,
  delay = 0,
  y = 16,
  className,
  duration = 0.6,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
