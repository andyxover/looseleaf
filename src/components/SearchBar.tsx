"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Loader2, X } from "lucide-react";

import { searchEntries, type SearchResult } from "@/app/search-actions";
import { PhotoImage } from "@/components/PhotoImage";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against an out-of-order slow response overwriting a newer one.
  const seq = useRef(0);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      const r = await searchEntries(q);
      if (mySeq !== seq.current) return; // stale
      setResults(r);
      setLoading(false);
      setOpen(true);
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Cmd/Ctrl+K focuses; Escape clears/closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search entries…"
          className="w-full rounded-full border border-zinc-200 bg-white/80 py-3 pl-11 pr-20 text-base outline-none backdrop-blur transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/70 dark:focus:border-zinc-600"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {loading && <Loader2 className="size-4 animate-spin text-zinc-400" />}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="grid size-6 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              aria-label="Clear"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="hidden rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline dark:border-zinc-700">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
              {loading ? "Searching…" : "No matches"}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
                {results.length} result{results.length === 1 ? "" : "s"}
              </div>
              <ul>
                {results.map((r) => {
                  const dateLabel = new Date(r.date).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  );
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/journal/${r.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                          {r.cover && (
                            <PhotoImage
                              src={r.cover}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-serif text-base leading-tight">
                            {r.title}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                            {dateLabel} · {r.photoCount} ph
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
