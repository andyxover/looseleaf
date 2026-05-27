"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Google-Photos-style timeline rail on the right edge. Year ticks span the
// archive (newest top → oldest bottom); hovering shows the date at that point,
// and clicking re-anchors the home feed to that period (via ?d=). Desktop only.
export function TimelineRail({
  newest,
  oldest,
  anchor,
}: {
  newest: string;
  oldest: string;
  anchor: string | null;
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ frac: number; label: string } | null>(
    null,
  );

  const maxT = new Date(newest).getTime();
  const minT = new Date(oldest).getTime();
  const range = Math.max(1, maxT - minT);

  const dateAt = (frac: number) => new Date(maxT - frac * range);
  const fracForT = (t: number) => Math.min(1, Math.max(0, (maxT - t) / range));
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const maxY = new Date(newest).getUTCFullYear();
  const minY = new Date(oldest).getUTCFullYear();
  const years: { year: number; frac: number }[] = [];
  for (let y = maxY; y >= minY; y--) {
    years.push({ year: y, frac: fracForT(Date.UTC(y, 0, 1)) });
  }

  function fracFromClientY(clientY: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  }

  function jump(frac: number) {
    if (frac < 0.012) {
      router.push("/");
      return;
    }
    router.push(`/?d=${dateAt(frac).toISOString().slice(0, 10)}`);
  }

  const handleFrac = anchor ? fracForT(new Date(anchor).getTime()) : 0;

  return (
    <div className="fixed right-0 top-28 bottom-28 z-40 hidden w-16 md:block">
      <div
        ref={trackRef}
        className="group relative h-full cursor-pointer"
        onPointerMove={(e) => {
          const frac = fracFromClientY(e.clientY);
          setHover({ frac, label: fmt(dateAt(frac)) });
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => jump(fracFromClientY(e.clientY))}
      >
        {/* track line */}
        <div className="absolute right-3 top-0 h-full w-px bg-zinc-300/70 transition group-hover:bg-zinc-400 dark:bg-zinc-700/70" />

        {/* year labels */}
        {years.map((y) => (
          <div
            key={y.year}
            className="pointer-events-none absolute right-5 -translate-y-1/2 font-mono text-[10px] tracking-wide text-zinc-400 transition group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
            style={{ top: `${y.frac * 100}%` }}
          >
            {y.year}
          </div>
        ))}

        {/* current anchor handle */}
        <div
          className="pointer-events-none absolute right-[9px] size-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow dark:border-zinc-950"
          style={{ top: `${handleFrac * 100}%` }}
        />

        {/* hover date pill */}
        {hover && (
          <>
            <div
              className="pointer-events-none absolute right-3 h-px w-3 -translate-y-1/2 bg-accent"
              style={{ top: `${hover.frac * 100}%` }}
            />
            <div
              className="pointer-events-none absolute right-8 -translate-y-1/2 whitespace-nowrap rounded-full bg-zinc-900 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
              style={{ top: `${hover.frac * 100}%` }}
            >
              {hover.label}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
