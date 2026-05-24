"use client";

import { motion, useReducedMotion } from "motion/react";
import { Cog } from "lucide-react";

export function RotatingBadge({
  size = 96,
  text = "LOOSELEAF · PHOTO JOURNAL · ",
  iconSize = 18,
  className = "",
}: {
  size?: number;
  text?: string;
  iconSize?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  // Repeat text so it tiles around the circle.
  const fullText = (text.repeat(3)).slice(0, 60);
  const radius = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 22, ease: "linear", repeat: Infinity }}
        className="absolute inset-0"
      >
        <defs>
          <path
            id={`circle-${size}`}
            d={`M ${cx} ${cy} m -${radius} 0 a ${radius} ${radius} 0 1 1 ${radius * 2} 0 a ${radius} ${radius} 0 1 1 -${radius * 2} 0`}
          />
        </defs>
        <text
          className="fill-current font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.18em" }}
        >
          <textPath href={`#circle-${size}`}>{fullText}</textPath>
        </text>
      </motion.svg>
      <motion.div
        animate={reduced ? undefined : { rotate: -360 }}
        transition={{ duration: 12, ease: "linear", repeat: Infinity }}
        className="relative"
      >
        <Cog size={iconSize} strokeWidth={1.25} />
      </motion.div>
    </div>
  );
}
