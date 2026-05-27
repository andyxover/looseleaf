"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { PhotoImage } from "@/components/PhotoImage";

export type TimelineEntry = {
  id: string;
  title: string;
  date: string; // ISO, list is sorted newest → oldest
  cover: string | null;
};

const GAP = 4;
const TARGET = 220; // target tile size in px

function fmt(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();
}

// A justified, virtualized photo-grid of every entry with a live drag-scrubber
// on the right. Uniform square tiles → row heights are known without
// rendering, so scroll position ↔ date is exact and only on-screen rows mount.
export function TimelineGrid({ entries }: { entries: TimelineEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState<{ frac: number; label: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = size.w > 0 ? Math.max(2, Math.floor((size.w + GAP) / (TARGET + GAP))) : 3;
  const tile = size.w > 0 ? (size.w - GAP * (cols - 1)) / cols : TARGET;
  const rowH = tile + GAP;
  const rowCount = Math.ceil(entries.length / cols);
  const totalH = rowCount * rowH;
  const maxScroll = Math.max(0, totalH - size.h);

  const overscan = 3;
  const firstRow = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
  const lastRow = Math.min(rowCount - 1, Math.ceil((scrollTop + size.h) / rowH) + overscan);

  const visible: { e: TimelineEntry; top: number; left: number }[] = [];
  if (size.w > 0) {
    for (let r = firstRow; r <= lastRow; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (i >= entries.length) break;
        visible.push({ e: entries[i], top: r * rowH, left: c * (tile + GAP) });
      }
    }
  }

  // Year ticks positioned by entry index (count), like Google Photos.
  const ticks = useMemo(() => {
    const out: { year: number; frac: number }[] = [];
    let last: number | null = null;
    entries.forEach((e, i) => {
      const y = new Date(e.date).getUTCFullYear();
      if (y !== last) {
        last = y;
        const row = Math.floor(i / cols);
        out.push({ year: y, frac: rowCount > 1 ? row / (rowCount - 1) : 0 });
      }
    });
    return out;
  }, [entries, cols, rowCount]);

  const curFrac = maxScroll > 0 ? scrollTop / maxScroll : 0;
  const topRow = Math.floor((scrollTop + rowH / 2) / rowH);
  const curEntry = entries[Math.min(entries.length - 1, Math.max(0, topRow * cols))];

  function dateAtFrac(frac: number): string {
    const row = Math.floor((frac * maxScroll) / rowH);
    const e = entries[Math.min(entries.length - 1, Math.max(0, row * cols))];
    return e ? fmt(e.date) : "";
  }

  function fracFromClientY(clientY: number): number {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  }

  function scrubTo(frac: number) {
    const el = scrollRef.current;
    if (el) el.scrollTop = frac * maxScroll;
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain"
      >
        <div style={{ height: totalH, position: "relative" }}>
          {visible.map(({ e, top, left }) => (
            <Link
              key={e.id}
              href={`/journal/${e.id}`}
              style={{ position: "absolute", top, left, width: tile, height: tile }}
              className="group block overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800"
            >
              {e.cover ? (
                <PhotoImage
                  src={e.cover}
                  alt={e.title}
                  fill
                  sizes="240px"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full items-center justify-center p-2 text-center font-serif text-sm text-zinc-500">
                  {e.title}
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <span className="line-clamp-2 text-xs font-medium text-white">
                  {e.title}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* current month, floating */}
      {curEntry && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-zinc-900/80 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white backdrop-blur dark:bg-zinc-100/80 dark:text-zinc-900">
          {fmt(curEntry.date)}
        </div>
      )}

      {/* live scrubber */}
      <div
        ref={railRef}
        className="fixed right-0 top-16 bottom-4 z-40 w-14 cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          const f = fracFromClientY(e.clientY);
          scrubTo(f);
          setHover({ frac: f, label: dateAtFrac(f) });
        }}
        onPointerMove={(e) => {
          const f = fracFromClientY(e.clientY);
          setHover({ frac: f, label: dateAtFrac(f) });
          if (dragging) scrubTo(f);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerLeave={() => {
          if (!dragging) setHover(null);
        }}
      >
        <div className="absolute right-3 top-0 h-full w-px bg-zinc-300/70 dark:bg-zinc-700/70" />
        {ticks.map((t) => (
          <div
            key={t.year}
            className="pointer-events-none absolute right-5 -translate-y-1/2 font-mono text-[10px] text-zinc-400"
            style={{ top: `${t.frac * 100}%` }}
          >
            {t.year}
          </div>
        ))}
        <div
          className="pointer-events-none absolute right-[9px] size-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow dark:border-zinc-950"
          style={{ top: `${curFrac * 100}%` }}
        />
        {hover && (
          <div
            className="pointer-events-none absolute right-8 -translate-y-1/2 whitespace-nowrap rounded-full bg-zinc-900 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
            style={{ top: `${hover.frac * 100}%` }}
          >
            {hover.label}
          </div>
        )}
      </div>
    </div>
  );
}
