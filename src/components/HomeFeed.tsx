"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { type FeedEntry, type Spread, buildSpreads } from "@/lib/feed";
import { loadMoreEntries } from "@/app/feed-actions";

import { FeaturedHero } from "@/components/spreads/FeaturedHero";
import { MonthHeader } from "@/components/spreads/MonthHeader";
import { MagazineSpread } from "@/components/spreads/MagazineSpread";
import { PullQuoteSpread } from "@/components/spreads/PullQuoteSpread";
import { ListSpread } from "@/components/spreads/ListSpread";

export function HomeFeed({
  initialEntries,
  initialCursor,
}: {
  initialEntries: FeedEntry[];
  initialCursor: string | null;
}) {
  const [entries, setEntries] = useState<FeedEntry[]>(initialEntries);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialCursor === null);

  const spreads: Spread[] = buildSpreads(entries, true);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastFetchedCursor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (loading || done || !cursor) return;
    if (lastFetchedCursor.current === cursor) return; // dedup duplicate trips
    lastFetchedCursor.current = cursor;
    setLoading(true);
    try {
      const result = await loadMoreEntries(cursor);
      setEntries((prev) => [...prev, ...result.entries]);
      setCursor(result.nextCursor);
      if (result.nextCursor === null) setDone(true);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, done]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) load();
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [load]);

  return (
    <div className="space-y-2">
      {spreads.map((s, i) => {
        switch (s.type) {
          case "featured":
            return <FeaturedHero key={`f-${i}`} entry={s.entry} />;
          case "monthHeader":
            return (
              <MonthHeader key={`h-${i}-${s.label}`} label={s.label} count={s.count} />
            );
          case "magazine":
            return <MagazineSpread key={`m-${i}`} entries={s.entries} />;
          case "pullQuote":
            return (
              <PullQuoteSpread key={`q-${i}`} entry={s.entry} quote={s.quote} />
            );
          case "list":
            return <ListSpread key={`l-${i}`} entries={s.entries} />;
        }
      })}

      <div
        ref={sentinelRef}
        className="flex items-center justify-center py-16"
        aria-hidden
      >
        {loading ? (
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            Loading more…
          </div>
        ) : done ? (
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            ✦ End of archive ✦
          </div>
        ) : (
          <div className="h-12" />
        )}
      </div>
    </div>
  );
}
