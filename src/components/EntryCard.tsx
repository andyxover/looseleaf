"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

import { PhotoImage } from "@/components/PhotoImage";

type EntryCardProps = {
  id: string;
  title: string;
  date: Date;
  cover?: string | null;
  index: number;
  featured?: boolean;
};

export function EntryCard({
  id,
  title,
  date,
  cover,
  index,
  featured = false,
}: EntryCardProps) {
  const reduced = useReducedMotion();
  const delay = reduced ? 0 : Math.min(index, 8) * 0.06;
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // 3D tilt — track cursor position relative to the card and feed two spring-
  // damped rotations + a depth-driven shadow.
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 250, damping: 22, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 250, damping: 22, mass: 0.5 });
  // Featured cards are bigger — give them a slightly stronger tilt.
  const tiltMax = featured ? 8 : 5;
  const rotateX = useTransform(sy, [0, 1], [tiltMax, -tiltMax]);
  const rotateY = useTransform(sx, [0, 1], [-tiltMax, tiltMax]);
  // Shadow follows cursor — feels like the card is lifting toward it.
  const shadowX = useTransform(sx, [0, 1], [-16, 16]);
  const shadowY = useTransform(sy, [0, 1], [-12, 12]);
  const boxShadow = useTransform(
    [shadowX, shadowY],
    ([sxv, syv]: number[]) =>
      `${sxv}px ${syv}px 40px -8px rgba(0,0,0,0.25)`,
  );
  // Cursor-following highlight (always created so hook order is stable; only
  // rendered when motion is allowed).
  const highlightBg = useTransform(
    [sx, sy],
    ([x, y]: number[]) =>
      `radial-gradient(220px circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.18), transparent 70%)`,
  );

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
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={featured ? "" : "group"}
    >
      <Link href={`/journal/${id}`} className="block">
        <motion.div
          ref={ref}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={
            reduced
              ? undefined
              : { rotateX, rotateY, boxShadow, transformPerspective: 1200 }
          }
          className={`relative overflow-hidden rounded-xl bg-zinc-100 will-change-transform dark:bg-zinc-900 ${
            featured ? "aspect-[16/10]" : "aspect-[4/5]"
          }`}
        >
          {cover && (
            <motion.div
              className="absolute inset-0"
              whileHover={reduced ? undefined : { scale: 1.06 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <PhotoImage
                src={cover}
                alt={title}
                fill
                className="object-cover"
                sizes={
                  featured
                    ? "(min-width: 1024px) 960px, 100vw"
                    : "(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                }
              />
            </motion.div>
          )}
          {/* Soft cursor-following highlight — adds depth on hover */}
          {!reduced && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: highlightBg }}
            />
          )}
          {featured && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-8 text-white sm:p-10">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] opacity-70">
                  Latest · {dateLabel}
                </div>
                <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-5xl">
                  {title}
                </h2>
              </div>
            </>
          )}
        </motion.div>
        {!featured && (
          <div className="mt-4">
            <time className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {dateLabel}
            </time>
            <h2 className="mt-1.5 font-serif text-xl leading-snug tracking-tight transition group-hover:text-zinc-500 dark:group-hover:text-zinc-400">
              {title}
            </h2>
          </div>
        )}
      </Link>
    </motion.article>
  );
}
