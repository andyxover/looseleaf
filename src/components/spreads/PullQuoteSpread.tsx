"use client";

import Link from "next/link";

import type { FeedEntry } from "@/lib/feed";
import { Reveal } from "@/components/Reveal";

export function PullQuoteSpread({
  entry,
  quote,
}: {
  entry: FeedEntry;
  quote: { text: string; attribution?: string };
}) {
  return (
    <Reveal y={28} duration={1.0}>
      <Link
        href={`/journal/${entry.id}`}
        className="my-24 block border-y-2 border-zinc-900 py-16 text-center transition hover:bg-zinc-50 dark:border-zinc-100 dark:hover:bg-zinc-900"
      >
        <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          Pulled from the archive
        </div>
        <blockquote className="font-serif text-3xl italic leading-snug tracking-tight sm:text-5xl">
          &ldquo;{quote.text}&rdquo;
        </blockquote>
        {quote.attribution && (
          <footer className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            — {quote.attribution}
          </footer>
        )}
        <div className="mt-10 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
          From: <span className="text-zinc-700 dark:text-zinc-300">{entry.title}</span>
        </div>
      </Link>
    </Reveal>
  );
}
