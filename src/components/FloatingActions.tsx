"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { ArrowUp, Home, Heart, Share2, Check } from "lucide-react";

import { getLikeState, toggleLike } from "@/app/engagement-actions";

// Persistent bottom-right action cluster:
//  - Like + Share (only on a journal entry) — float above the rest
//  - Back to top — visible after scrolling past one viewport
//  - Home (only on non-home pages) — fades in with the back-to-top
export function FloatingActions() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [120, 320], [0, 1]);
  const pointerEvents = useTransform(scrollY, (v) => (v > 120 ? "auto" : "none"));

  const isHome = pathname === "/";
  const isShared = pathname?.startsWith("/share/") ?? false;
  const journalId = pathname?.match(/^\/journal\/([^/]+)$/)?.[1] ?? null;

  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!journalId) return;
    let cancelled = false;
    getLikeState(journalId)
      .then((s) => {
        if (!cancelled) setLiked(s.liked);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [journalId]);

  // On a shared entry, hide the cluster entirely (recipient has no nav back).
  if (isShared) return null;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onLike() {
    if (!journalId || likeBusy) return;
    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    try {
      const res = await toggleLike(journalId);
      setLiked(res.liked);
    } catch {
      setLiked(!next);
    } finally {
      setLikeBusy(false);
    }
  }

  async function onShare() {
    const url = window.location.href;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch {
        // cancelled / unsupported — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const whiteCircle =
    "grid size-12 place-items-center rounded-full border border-zinc-200 bg-white/90 text-zinc-700 shadow-lg shadow-zinc-900/5 backdrop-blur transition hover:bg-white hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-900";

  return (
    <motion.div
      style={{ opacity, pointerEvents }}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 print:hidden"
    >
      {journalId && (
        <>
          <motion.button
            type="button"
            onClick={onLike}
            aria-pressed={liked}
            whileHover={reduced ? undefined : { scale: 1.08 }}
            whileTap={reduced ? undefined : { scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className={whiteCircle}
            aria-label={liked ? "Unlike" : "Like"}
            title={liked ? "Unlike" : "Like"}
          >
            <Heart
              className={`size-5 transition ${
                liked ? "fill-accent text-accent" : ""
              }`}
            />
          </motion.button>
          <motion.button
            type="button"
            onClick={onShare}
            whileHover={reduced ? undefined : { scale: 1.08 }}
            whileTap={reduced ? undefined : { scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className={whiteCircle}
            aria-label="Share"
            title={copied ? "Link copied!" : "Share"}
          >
            {copied ? (
              <Check className="size-5 text-green-600" />
            ) : (
              <Share2 className="size-5" />
            )}
          </motion.button>
        </>
      )}

      {!isHome && (
        <motion.div
          whileHover={reduced ? undefined : { scale: 1.08 }}
          whileTap={reduced ? undefined : { scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
        >
          <Link
            href="/"
            className="grid size-12 place-items-center rounded-full bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 transition hover:shadow-xl hover:shadow-zinc-900/30 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-zinc-100/20 dark:hover:shadow-zinc-100/30"
            aria-label="Back to home"
            title="Home"
          >
            <Home className="size-5" />
          </Link>
        </motion.div>
      )}
      <motion.button
        type="button"
        onClick={scrollToTop}
        whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 20 }}
        className={whiteCircle}
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUp className="size-5" />
      </motion.button>
    </motion.div>
  );
}
