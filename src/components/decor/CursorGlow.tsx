"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "motion/react";

export function CursorGlow() {
  const reduced = useReducedMotion();
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  // Spring for a soft lag — feels alive rather than glued to the cursor.
  const sx = useSpring(x, { damping: 30, stiffness: 180, mass: 0.6 });
  const sy = useSpring(y, { damping: 30, stiffness: 180, mass: 0.6 });

  useEffect(() => {
    if (reduced) return;
    // Skip on coarse pointers (touch screens) — the glow would sit dead at 0,0.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }
    function onMove(e: MouseEvent) {
      x.set(e.clientX);
      y.set(e.clientY);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduced, x, y]);

  if (reduced) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen"
      style={{
        left: sx,
        top: sy,
        width: 460,
        height: 460,
        backgroundImage:
          "radial-gradient(closest-side, rgba(251, 191, 36, 0.18), rgba(244, 114, 182, 0.10) 45%, transparent 70%)",
      }}
    />
  );
}
