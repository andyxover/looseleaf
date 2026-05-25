"use client";

import { useEffect, useState } from "react";

import type { Lang } from "@/lib/lang";

// EN | 中 segmented toggle. Persists the choice in a cookie, then does a full
// reload so the server re-renders everything (home feed included) in the chosen
// language. A plain router.refresh() wasn't enough: the home feed seeds its
// entries into client state once and ignores the refreshed server props, so the
// language only appeared to change after a later navigation.
export function LangToggle({ initial }: { initial: Lang }) {
  const [lang, setLang] = useState<Lang>(initial);
  const [switching, setSwitching] = useState(false);

  // Keep state in sync if the cookie changed elsewhere.
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)lang=(en|zh)/);
    if (m && (m[1] === "en" || m[1] === "zh")) setLang(m[1]);
  }, []);

  function choose(next: Lang) {
    if (next === lang || switching) return;
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    setLang(next);
    setSwitching(true);
    window.location.reload();
  }

  return (
    <div
      className={`inline-flex overflow-hidden rounded-full border border-zinc-300 text-xs font-medium dark:border-zinc-700 ${switching ? "opacity-60" : ""}`}
      role="group"
      aria-label="Language"
    >
      {(["en", "zh"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={lang === l}
          className={`px-3 py-1.5 transition ${
            lang === l
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {l === "en" ? "EN" : "中"}
        </button>
      ))}
    </div>
  );
}
