import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus, LogIn, LogOut, LayoutGrid } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { isOwner, isEditor } from "@/lib/owner";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { FadeIn } from "@/components/Reveal";
import { MagneticButton } from "@/components/decor/MagneticButton";
import { PhotoStrip } from "@/components/decor/PhotoStrip";
import { HomeView } from "@/components/HomeView";
import { LeafHero } from "@/components/hero/LeafHero";
import { ArchiveShelf } from "@/components/hero/ArchiveShelf";
import { SearchBar } from "@/components/SearchBar";
import { BrowseEntries } from "@/components/BrowseEntries";
import { LangToggle } from "@/components/LangToggle";
import { pageToEntry } from "@/lib/feed";
import { getLang, resolveLayoutJson } from "@/lib/lang";

const INITIAL_PAGE = 40;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  // Optional timeline anchor: start the feed at this date and page older.
  const anchorDate =
    d && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? new Date(`${d}T23:59:59.999Z`)
      : null;

  const [rows, owner, editor, stripPhotos, lang, allRows] = await Promise.all([
    prisma.page.findMany({
      where: anchorDate ? { entryDate: { lte: anchorDate } } : undefined,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: INITIAL_PAGE,
      include: {
        photos: { orderBy: { order: "asc" }, take: 1 },
        _count: { select: { photos: true, likes: true } },
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
    // Lightweight index of every entry for the Browse dropdown.
    prisma.page.findMany({
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, entryDate: true },
    }),
  ]);
  const showAuthChrome = isSupabaseConfigured();
  // Which of these entries the current anonymous visitor has already liked.
  const visitorId = (await cookies()).get("lv_visitor")?.value ?? null;
  const likedIds = visitorId
    ? new Set(
        (
          await prisma.like.findMany({
            where: { visitorId, pageId: { in: rows.map((r) => r.id) } },
            select: { pageId: true },
          })
        ).map((l) => l.pageId),
      )
    : new Set<string>();
  const initialEntries = rows.map((p) =>
    pageToEntry({
      id: p.id,
      title: p.title,
      entryDate: p.entryDate,
      layoutJson: resolveLayoutJson(p, lang),
      photos: p.photos.map((ph) => ({ filePath: ph.filePath })),
      _photoCount: p._count.photos,
      views: p.views,
      _likeCount: p._count.likes,
      _liked: likedIds.has(p.id),
    }),
  );
  const initialCursor =
    rows.length === INITIAL_PAGE
      ? rows[rows.length - 1].entryDate.toISOString()
      : null;
  const allEntries = allRows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.entryDate.toISOString(),
  }));

  const heroLeaves = initialEntries
    .filter((e) => e.cover)
    .slice(0, 10)
    .map((e) => ({ id: e.id, src: e.cover!, title: e.title, date: e.date }));
  const filmSrc = fs.existsSync(path.join(process.cwd(), "public", "hero-film.mp4"))
    ? "/hero-film.mp4"
    : null;

  return (
    <div className="relative z-10">
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
            <Link
              href="/timeline"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">Timeline</span>
            </Link>
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

      {/* Hero — a pinned 3D room you scroll through: film, leaves, wordmark. */}
      <LeafHero leaves={heroLeaves} filmSrc={filmSrc}>
        <p className="mx-auto max-w-xl text-balance text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-xl">
          A personal photo journal — everyday moments, laid out like a magazine
          by machine.
        </p>
        {initialEntries.length > 0 && (
          /* No FadeIn here — the hero's outro timeline owns this reveal. */
          <div className="pointer-events-auto mx-auto mt-10 flex max-w-xl items-stretch gap-2 text-left">
            <div className="min-w-0 flex-1">
              <SearchBar />
            </div>
            <BrowseEntries entries={allEntries} />
          </div>
        )}
      </LeafHero>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-20">
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
          <ArchiveShelf>
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
          </ArchiveShelf>
        </footer>
      )}
    </div>
  );
}
