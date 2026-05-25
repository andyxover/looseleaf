"use client";

import { useRef, type ReactNode, type CSSProperties } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

// Small 3D tilt-on-hover wrapper for content photos. Cursor position drives
// spring-damped rotateX/Y; the child snaps back when the cursor leaves.
export function Tilt({
  children,
  intensity = 4,
  className = "",
  style,
}: {
  children: ReactNode;
  intensity?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 220, damping: 24, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 220, damping: 24, mass: 0.5 });
  const rotateX = useTransform(sy, [0, 1], [intensity, -intensity]);
  const rotateY = useTransform(sx, [0, 1], [-intensity, intensity]);

  function onMouseMove(e: React.MouseEvent) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function onMouseLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={
        reduced
          ? style
          : { ...style, rotateX, rotateY, transformPerspective: 1200 }
      }
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
}
