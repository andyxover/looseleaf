import Link from "next/link";
import { Plus, LogIn, LogOut } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { isOwner, isEditor } from "@/lib/owner";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { FadeIn } from "@/components/Reveal";
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
        <AmbientOrb variant="warm" size={520} className="-left-32 top-12" duration={22} />
        <AmbientOrb variant="cool" size={420} className="right-0 top-32" duration={28} />
      </div>

      <header className="mx-auto flex max-w-6xl items-end justify-between px-6 pt-10 pb-6 sm:pt-16">
        <FadeIn>
          <div className="flex items-end gap-6">
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                A Photo Journal
              </div>
              <h1 className="font-serif text-5xl leading-none tracking-tight sm:text-6xl">
                Looseleaf
              </h1>
            </div>
            <RotatingBadge size={72} iconSize={16} className="hidden text-zinc-700 sm:grid dark:text-zinc-300" />
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="flex items-center gap-3">
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
                  className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition duration-1000 group-hover:translate-x-full dark:via-zinc-900/20" />
                  <Plus className="relative size-4" />
                  <span className="relative">New entry</span>
                </Link>
              </MagneticButton>
            )}
          </div>
        </FadeIn>
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
