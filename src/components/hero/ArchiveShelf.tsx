"use client";

// The archive strip as a physical object: it enters tilted back like a contact
// sheet lying on a desk and levels out as it reaches eye height.

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import type { ReactNode } from "react";

export function ArchiveShelf({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const eased = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const rotateX = useTransform(eased, [0, 1], [26, 0]);
  const y = useTransform(eased, [0, 1], [48, 0]);
  const opacity = useTransform(eased, [0, 0.4], [0.4, 1]);

  if (reduced) return <div>{children}</div>;

  return (
    <div ref={ref} style={{ perspective: 1100 }}>
      <motion.div
        style={{ rotateX, y, opacity, transformOrigin: "50% 100%" }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
