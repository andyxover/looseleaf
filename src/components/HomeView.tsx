"use client";

// Switches the home page between the classic magazine feed and the immersive
// orbit gallery. The choice persists in localStorage; Three.js only loads the
// first time orbit is opened.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, Orbit } from "lucide-react";

import type { FeedEntry } from "@/lib/feed";
import { HomeFeed } from "@/components/HomeFeed";

const OrbitGallery = dynamic(
  () => import("@/components/orbit/OrbitGallery").then((m) => m.OrbitGallery),
  { ssr: false },
);

type View = "classic" | "orbit";
const STORAGE_KEY = "looseleaf:view";

export function HomeView({
  initialEntries,
  initialCursor,
}: {
  initialEntries: FeedEntry[];
  initialCursor: string | null;
}) {
  // Render classic on the server so the feed stays crawlable; the stored
  // preference applies after hydration.
  const [view, setView] = useState<View>("classic");
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "orbit") setView("orbit");
  }, []);

  function choose(next: View) {
    setView(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const orbitEntries = initialEntries.filter((e) => e.cover);

  return (
    <>
      <HomeFeed initialEntries={initialEntries} initialCursor={initialCursor} />
      {view === "orbit" && orbitEntries.length > 0 && (
        <OrbitGallery entries={orbitEntries} onExit={() => choose("classic")} />
      )}

      {/* View switch — a quiet pill in the corner, above the orbit overlay. */}
      {orbitEntries.length > 0 && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-1 rounded-full border border-zinc-700/40 bg-zinc-900/80 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => choose("classic")}
            aria-label="Classic feed view"
            aria-pressed={view === "classic"}
            className={`rounded-full p-2 transition ${
              view === "classic"
                ? "bg-paper text-zinc-900"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => choose("orbit")}
            aria-label="Orbit gallery view"
            aria-pressed={view === "orbit"}
            className={`rounded-full p-2 transition ${
              view === "orbit"
                ? "bg-paper text-zinc-900"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <Orbit className="size-4" />
          </button>
        </div>
      )}
    </>
  );
}
