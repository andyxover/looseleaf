import Link from "next/link";
import { Plus, LogIn, LogOut } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { isOwner, isEditor } from "@/lib/owner";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { FadeIn, MaskReveal } from "@/components/Reveal";
import { RotatingBadge } from "@/components/decor/RotatingBadge";
import { Marquee } from "@/components/decor/Marquee";
import { AmbientOrb } from "@/components/decor/AmbientOrb";
import { MagneticButton } from "@/components/decor/MagneticButton";
import { PhotoStrip } from "@/components/decor/PhotoStrip";
import { HomeFeed } from "@/components/HomeFeed";
import { pageToEntry } from "@/lib/feed";

const INITIAL_PAGE = 40;

export default async function Home() {
  const [rows, owner, editor, stripPhotos] = await Promise.all([
    prisma.page.findMany({
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: INITIAL_PAGE,
      include: {
        photos: { orderBy: { order: "asc" }, take: 1 },
        _count: { select: { photos: true } },
      },
    }),
    isOwner(),
    isEditor(),
    prisma.photo.findMany({
      orderBy: { id: "desc" },
      take: 30,
      select: { filePath: true, width: true, height: true },
    }),
  ]);
  const showAuthChrome = isSupabaseConfigured();
  const initialEntries = rows.map((p) =>
    pageToEntry({
      id: p.id,
      title: p.title,
      entryDate: p.entryDate,
      layoutJson: p.layoutJson,
      photos: p.photos.map((ph) => ({ filePath: ph.filePath })),
      _photoCount: p._count.photos,
    }),
  );
  const initialCursor =
    rows.length === INITIAL_PAGE
      ? rows[rows.length - 1].entryDate.toISOString()
      : null;

  return (
    <div className="relative z-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] overflow-hidden">
        <AmbientOrb variant="warm" size={460} className="-left-32 top-12 opacity-70" duration={22} />
        <AmbientOrb variant="neutral" size={360} className="right-0 top-32 opacity-50" duration={28} />
      </div>

      <header className="border-t-2 border-zinc-900 dark:border-zinc-100">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="flex items-center justify-between gap-4 border-b border-zinc-300/70 py-3 dark:border-zinc-800">
              <div className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 sm:block">
                Vol. 01 <span className="text-accent">·</span> An archive of moments
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {showAuthChrome &&
                  (editor ? (
                    <form action="/auth/signout" method="POST">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <LogOut className="size-4" />
                        Sign out
                      </button>
                    </form>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <LogIn className="size-4" />
                      Sign in
                    </Link>
                  ))}
                {owner && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    Admin
                  </Link>
                )}
                {editor && (
                  <MagneticButton>
                    <Link
                      href="/create"
                      className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-ink"
                    >
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-1000 group-hover:translate-x-full" />
                      <Plus className="relative size-4" />
                      <span className="relative">New entry</span>
                    </Link>
                  </MagneticButton>
                )}
              </div>
            </div>
          </FadeIn>

          <div className="flex items-end justify-between gap-6 pt-7 pb-4 sm:pt-11 sm:pb-6">
            <h1 className="font-serif text-[3.75rem] font-black leading-[0.82] tracking-[-0.045em] sm:text-8xl lg:text-[9.5rem]">
              <MaskReveal delay={0.1} duration={0.9} pb="0.04em">
                Looseleaf<span className="text-accent">.</span>
              </MaskReveal>
            </h1>
            <FadeIn delay={0.55} y={0}>
              <RotatingBadge
                size={84}
                iconSize={18}
                className="mb-2 hidden shrink-0 text-zinc-700 sm:grid dark:text-zinc-300"
              />
            </FadeIn>
          </div>

          <FadeIn delay={0.12}>
            <div className="flex items-baseline justify-between border-t border-zinc-300/70 pt-3 dark:border-zinc-800">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                A personal photo journal <span className="text-accent">·</span> laid out by machine
              </p>
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400 sm:block">
                Est. 2026
              </p>
            </div>
          </FadeIn>
        </div>
      </header>

      <FadeIn delay={0.15}>
        <Marquee />
      </FadeIn>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-12">
        {initialEntries.length === 0 ? (
          <FadeIn delay={0.2}>
            <div className="mt-32 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
                No entries yet
              </p>
              <Link
                href="/create"
                className="mt-6 inline-block font-serif text-2xl tracking-tight underline underline-offset-8 decoration-zinc-300 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
              >
                Make your first one →
              </Link>
            </div>
          </FadeIn>
        ) : (
          <HomeFeed initialEntries={initialEntries} initialCursor={initialCursor} />
        )}
      </main>

      {stripPhotos.length > 0 && (
        <footer className="relative z-10 pb-12">
          <div className="mx-auto mb-3 max-w-6xl px-6">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                The archive
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                {stripPhotos.length.toString().padStart(3, "0")} photos
              </div>
            </div>
          </div>
          <PhotoStrip photos={stripPhotos} />
        </footer>
      )}
    </div>
  );
}
