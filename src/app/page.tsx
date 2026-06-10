import Link from "next/link";
import { Plus, LogIn, LogOut } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { isOwner, isEditor } from "@/lib/owner";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { FadeIn } from "@/components/Reveal";
import { AnimatedWordmark } from "@/components/AnimatedWordmark";
import { AmbientOrb } from "@/components/decor/AmbientOrb";
import { MagneticButton } from "@/components/decor/MagneticButton";
import { PhotoStrip } from "@/components/decor/PhotoStrip";
import { HomeView } from "@/components/HomeView";
import { SearchBar } from "@/components/SearchBar";
import { LangToggle } from "@/components/LangToggle";
import { pageToEntry } from "@/lib/feed";
import { getLang, resolveLayoutJson } from "@/lib/lang";

const INITIAL_PAGE = 40;

export default async function Home() {
  const [rows, owner, editor, stripPhotos, lang] = await Promise.all([
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
    getLang(),
  ]);
  const showAuthChrome = isSupabaseConfigured();
  const initialEntries = rows.map((p) =>
    pageToEntry({
      id: p.id,
      title: p.title,
      entryDate: p.entryDate,
      layoutJson: resolveLayoutJson(p, lang),
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
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[55vh] overflow-hidden">
        <AmbientOrb
          variant="warm"
          size={520}
          className="left-1/2 top-0 -translate-x-1/2 opacity-40"
          duration={26}
        />
      </div>

      {/* Minimal nav — a quiet hairline bar; the brand statement lives in the hero below. */}
      <header className="border-b border-zinc-200/70 dark:border-zinc-800/70">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Looseleaf
          </Link>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <LangToggle initial={lang} />
            {showAuthChrome &&
              (editor ? (
                <form action="/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <LogIn className="size-4" />
                  Sign in
                </Link>
              ))}
            {owner && (
              <Link
                href="/admin"
                className="rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Admin
              </Link>
            )}
            {editor && (
              <MagneticButton>
                <Link
                  href="/create"
                  className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-ink"
                >
                  <Plus className="size-4" />
                  New entry
                </Link>
              </MagneticButton>
            )}
          </div>
        </nav>
      </header>

      {/* Hero — one centered focal point with room to breathe. */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center sm:pt-32 sm:pb-24">
        <h1 className="font-serif text-[3.5rem] font-black leading-[0.95] tracking-[-0.04em] sm:text-8xl lg:text-[7.5rem]">
          <AnimatedWordmark />
        </h1>
        <FadeIn delay={0.3}>
          <p className="mx-auto mt-8 max-w-xl text-balance text-lg leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-xl">
            A personal photo journal — everyday moments, laid out like a magazine by machine.
          </p>
        </FadeIn>
        {initialEntries.length > 0 && (
          <FadeIn delay={0.42}>
            <div className="mx-auto mt-12 max-w-md">
              <SearchBar />
            </div>
          </FadeIn>
        )}
      </section>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-4">
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
          <HomeView initialEntries={initialEntries} initialCursor={initialCursor} />
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
