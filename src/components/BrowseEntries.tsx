"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown } from "lucide-react";

export type IndexEntry = { id: string; title: string; date: string };

type Group = { key: string; label: string; entries: IndexEntry[] };

function groupByMonth(entries: IndexEntry[]): Group[] {
  const groups: Group[] = [];
  for (const e of entries) {
    const key = e.date.slice(0, 7); // YYYY-MM
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const d = new Date(`${key}-15T12:00:00Z`);
      g = {
        key,
        label: d
          .toLocaleDateString("en-US", { month: "long", year: "numeric" })
          .toUpperCase(),
        entries: [],
      };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}

// "Browse" dropdown beside the search bar: a month-grouped index of every
// entry (day + title) to jump straight to one.
export function BrowseEntries({ entries }: { entries: IndexEntry[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupByMonth(entries), [entries]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Browse all entries"
        className="inline-flex h-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-600 backdrop-blur transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        <CalendarDays className="size-4" />
        <span className="hidden sm:inline">Browse</span>
        <ChevronDown
          className={`size-3.5 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[20rem] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
            {entries.length} entries
          </div>
          {groups.map((g) => (
            <div key={g.key}>
              <div className="sticky top-0 z-10 flex items-baseline justify-between border-y border-zinc-100 bg-white/95 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/95">
                <span>{g.label}</span>
                <span className="text-zinc-400">
                  {g.entries.length.toString().padStart(2, "0")}
                </span>
              </div>
              <ul>
                {g.entries.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/journal/${e.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-baseline gap-3 px-4 py-2 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <span className="w-6 shrink-0 text-right font-mono text-[11px] text-zinc-400">
                        {new Date(e.date).getUTCDate()}
                      </span>
                      <span className="truncate text-zinc-700 dark:text-zinc-300">
                        {e.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
