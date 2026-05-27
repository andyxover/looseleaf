"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";

// Share affordance for a post. Uses the native share sheet when available
// (mobile), otherwise opens a small popover with copy-link + quick links
// (LINE for the TW audience, Facebook, X).
export function ShareButton({ title }: { title: string }) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  async function onShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to popover
      }
    }
    setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const enc = encodeURIComponent(url);
  const encT = encodeURIComponent(title);
  const links = [
    { label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${enc}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${enc}&text=${encT}` },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onShare}
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <Share2 className="size-5 text-zinc-400" />
        Share
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={copy}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {copied ? (
              <>
                <Check className="size-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <LinkIcon className="size-4 text-zinc-400" />
                Copy link
              </>
            )}
          </button>
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <span className="grid size-4 place-items-center font-mono text-[10px] text-zinc-400">
                ↗
              </span>
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
