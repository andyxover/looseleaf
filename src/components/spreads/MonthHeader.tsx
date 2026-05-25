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
      <div className="mt-20 mb-6 flex items-baseline justify-between border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
          {label}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
          {count.toString().padStart(2, "0")} {count === 1 ? "Entry" : "Entries"}
        </div>
      </div>
    </FadeIn>
  );
}
