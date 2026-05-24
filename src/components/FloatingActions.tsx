"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { ArrowUp, Home } from "lucide-react";

// Persistent bottom-right action cluster:
//  - Back to top — visible after scrolling past one viewport
//  - Home (only on non-home pages) — fades in with the back-to-top
//
// Both buttons have a magnetic-feel hover (scale + subtle shadow expand).
export function FloatingActions() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  // Fade in after 240px of scroll so they don't fight the masthead at the top.
  const opacity = useTransform(scrollY, [120, 320], [0, 1]);
  const pointerEvents = useTransform(scrollY, (v) => (v > 120 ? "auto" : "none"));

  const isHome = pathname === "/";

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <motion.div
      style={{ opacity, pointerEvents }}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 print:hidden"
      aria-hidden={false}
    >
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
        className="grid size-12 place-items-center rounded-full border border-zinc-200 bg-white/90 text-zinc-700 shadow-lg shadow-zinc-900/5 backdrop-blur transition hover:bg-white hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-900"
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUp className="size-5" />
      </motion.button>
    </motion.div>
  );
}
