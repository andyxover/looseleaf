"use client";

import { FadeIn } from "@/components/Reveal";

export function MonthHeader({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <FadeIn>
      <div className="mt-20 mb-6 flex items-baseline justify-between border-t-2 border-zinc-900 pt-4 dark:border-zinc-100">
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-700 dark:text-zinc-300">
          {label}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
          {count.toString().padStart(2, "0")} {count === 1 ? "Entry" : "Entries"}
        </div>
      </div>
    </FadeIn>
  );
}
