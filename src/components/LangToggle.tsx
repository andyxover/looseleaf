"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Lang } from "@/lib/lang";

// EN | 中 segmented toggle. Persists choice in a cookie and refreshes so the
// server re-renders every entry in the chosen language.
export function LangToggle({ initial }: { initial: Lang }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initial);
  const [pending, startTransition] = useTransition();

  // Keep state in sync if the cookie changed elsewhere.
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)lang=(en|zh)/);
    if (m && (m[1] === "en" || m[1] === "zh")) setLang(m[1]);
  }, []);

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    setLang(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={`inline-flex overflow-hidden rounded-full border border-zinc-300 text-xs font-medium dark:border-zinc-700 ${pending ? "opacity-60" : ""}`}
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
