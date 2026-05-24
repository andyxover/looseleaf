import Link from "next/link";
import { Plus, LogIn, LogOut } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { isOwner } from "@/lib/owner";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { EntryCard } from "@/components/EntryCard";
import { FadeIn } from "@/components/Reveal";
import { RotatingBadge } from "@/components/decor/RotatingBadge";
import { Marquee } from "@/components/decor/Marquee";
import { AmbientOrb } from "@/components/decor/AmbientOrb";
import { WavyDivider } from "@/components/decor/WavyDivider";
import { MagneticButton } from "@/components/decor/MagneticButton";
import { PhotoStrip } from "@/components/decor/PhotoStrip";

export default async function Home() {
  const [pages, owner, stripPhotos] = await Promise.all([
    prisma.page.findMany({
      orderBy: { createdAt: "desc" },
      include: { photos: { orderBy: { order: "asc" }, take: 1 } },
    }),
    isOwner(),
    prisma.photo.findMany({
      orderBy: { id: "desc" },
      take: 30,
      select: { filePath: true, width: true, height: true },
    }),
  ]);
  const showAuthChrome = isSupabaseConfigured();
  const [featured, ...rest] = pages;

  return (
    <div className="relative z-10">
      {/* Ambient orbs behind the masthead — drift slowly to give the page a heartbeat */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] overflow-hidden">
        <AmbientOrb
          variant="warm"
          size={520}
          className="-left-32 top-12"
          duration={22}
        />
        <AmbientOrb
          variant="cool"
          size={420}
          className="right-0 top-32"
          duration={28}
        />
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
            <RotatingBadge
              size={72}
              iconSize={16}
              className="hidden text-zinc-700 sm:grid dark:text-zinc-300"
            />
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="flex items-center gap-3">
            {showAuthChrome &&
              (owner ? (
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

      <main className="mx-auto max-w-6xl px-6 pb-16">
        {pages.length === 0 ? (
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
          <>
            {featured && (
              <section className="mt-8 sm:mt-12">
                <EntryCard
                  id={featured.id}
                  title={featured.title}
                  createdAt={featured.createdAt}
                  cover={featured.photos[0]?.filePath}
                  index={0}
                  featured
                />
              </section>
            )}
            {rest.length > 0 && (
              <section className="mt-20">
                <WavyDivider className="text-zinc-300 dark:text-zinc-700" />
                <div className="mb-8 mt-8 flex items-baseline justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                    Earlier entries
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    {rest.length.toString().padStart(2, "0")}
                  </div>
                </div>
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((page, i) => (
                    <EntryCard
                      key={page.id}
                      id={page.id}
                      title={page.title}
                      createdAt={page.createdAt}
                      cover={page.photos[0]?.filePath}
                      index={i + 1}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
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
