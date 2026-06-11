"use client";

// Scroll velocity leans the whole feed a fraction of a degree — pages caught
// in the breeze of your own scrolling. Springs back to dead flat at rest, so
// reading is never skewed.

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import type { ReactNode } from "react";

export function WindShear({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const eased = useSpring(velocity, { stiffness: 110, damping: 28, mass: 0.6 });
  const rotateX = useTransform(eased, [-2800, 0, 2800], [2.4, 0, -2.4]);
  const skewY = useTransform(eased, [-2800, 0, 2800], [0.5, 0, -0.5]);

  if (reduced) return <div>{children}</div>;

  return (
    <motion.div
      style={{ rotateX, skewY, transformPerspective: 1300 }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
}
