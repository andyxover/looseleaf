"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

import Link from "next/link";

import type { Block, Framing, Layout } from "@/lib/layout";
import { Gallery, type GalleryPhoto } from "@/components/Gallery";
import { PhotoImage } from "@/components/PhotoImage";
import { Reveal, FadeIn } from "@/components/Reveal";
import { Tilt } from "@/components/Tilt";
import { AmbientOrb } from "@/components/decor/AmbientOrb";
import { RotatingBadge } from "@/components/decor/RotatingBadge";
import { WavyDivider } from "@/components/decor/WavyDivider";
import { Marquee } from "@/components/decor/Marquee";
import { PhotoStrip } from "@/components/decor/PhotoStrip";

function framingStyle(f: Framing | null | undefined): React.CSSProperties {
  if (!f) return {};
  return {
    objectPosition: `${f.x * 100}% ${f.y * 100}%`,
    transform: `scale(${f.scale})`,
    transformOrigin: `${f.x * 100}% ${f.y * 100}%`,
  };
}

export type DisplayPhoto = {
  filePath: string;
  order: number;
  width?: number | null;
  height?: number | null;
};

function getPhoto(photos: DisplayPhoto[], idx: number): DisplayPhoto | null {
  return photos.find((p) => p.order === idx - 1) ?? null;
}

function Markdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4 last:mb-0">
          {renderInline(p)}
        </p>
      ))}
    </>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function naturalAspect(
  photo: DisplayPhoto,
  fallback: string,
): string {
  if (photo.width && photo.height) return `${photo.width} / ${photo.height}`;
  return fallback;
}

export function MagazinePage({
  layout,
  photos,
  createdAt,
}: {
  layout: Layout;
  photos: DisplayPhoto[];
  createdAt?: Date;
}) {
  const heroBlock = layout.blocks.find((b) => b.type === "hero");
  const heroPhoto = heroBlock?.type === "hero" ? getPhoto(photos, heroBlock.photoIdx) : null;
  // Render non-hero blocks below the masthead; the hero contributes the cover photo
  // and provides the section title context (we already display layout.title).
  const restBlocks = layout.blocks.filter((b) => b !== heroBlock);

  const dateLabel = createdAt
    ? createdAt
        .toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()
    : null;

  return (
    <article className="relative z-10 mx-auto max-w-3xl px-6 pb-12">
      {/* Ambient orbs drifting behind the masthead — soft color suggestion of the entry */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[55vh] overflow-hidden">
        <AmbientOrb
          variant="warm"
          size={460}
          className="-left-24 top-0"
          duration={24}
        />
        <AmbientOrb
          variant="cool"
          size={380}
          className="-right-16 top-24"
          duration={30}
        />
      </div>

      <Masthead title={layout.title} intro={layout.intro} />
      <EntryMetadata dateLabel={dateLabel} photoCount={photos.length} />
      {heroBlock?.type === "hero" && heroPhoto && (
        <HeroBlock block={heroBlock} photo={heroPhoto} />
      )}
      <FadeIn delay={0.6}>
        <WavyDivider className="mx-auto mt-16 max-w-md text-zinc-300 dark:text-zinc-700" />
      </FadeIn>

      {/* A second drift area deeper down so the page never feels static */}
      <div className="pointer-events-none absolute inset-x-0 top-[120vh] -z-10 h-[60vh] overflow-hidden">
        <AmbientOrb
          variant="cool"
          size={380}
          className="-left-20"
          duration={26}
        />
        <AmbientOrb
          variant="warm"
          size={320}
          className="right-0 top-32"
          duration={32}
        />
      </div>

      <div className="mt-12 space-y-16 sm:space-y-20">
        {restBlocks.map((block, i) => (
          <Reveal key={i} y={36} duration={0.85}>
            <BlockView block={block} photos={photos} />
          </Reveal>
        ))}
      </div>
    </article>
  );
}

function EntryMetadata({
  dateLabel,
  photoCount,
}: {
  dateLabel: string | null;
  photoCount: number;
}) {
  if (!dateLabel) return null;
  return (
    <FadeIn delay={0.45}>
      <div className="my-10 flex items-center justify-center gap-6 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        <span>{dateLabel}</span>
        <span className="h-px w-12 bg-zinc-300 dark:bg-zinc-700" />
        <span>{photoCount.toString().padStart(2, "0")} Photos</span>
        <span className="h-px w-12 bg-zinc-300 dark:bg-zinc-700" />
        <span>Looseleaf</span>
      </div>
    </FadeIn>
  );
}

function EntryFooter({ photos }: { photos: DisplayPhoto[] }) {
  return (
    <footer className="relative z-10 mt-32">
      <Reveal y={20}>
        <div className="mx-auto mb-10 max-w-3xl px-6 text-center">
          <WavyDivider className="mx-auto max-w-xs text-zinc-300 dark:text-zinc-700" />
          <div className="mt-10 grid place-items-center">
            <RotatingBadge
              size={88}
              iconSize={18}
              text="END · LOOSELEAF · "
              className="text-zinc-600 dark:text-zinc-400"
            />
          </div>
          <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.4em] text-zinc-500">
            ✦ Fin ✦
          </div>
          <Link
            href="/"
            className="mt-8 inline-block font-serif text-2xl tracking-tight underline underline-offset-[10px] decoration-zinc-300 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
          >
            Back to all entries
          </Link>
        </div>
      </Reveal>
      <Marquee
        items={["End of entry", "Looseleaf", "Photo journal", "Onward"]}
        duration={45}
      />
      {photos.length > 0 && (
        <div className="mt-12">
          <div className="mx-auto mb-3 max-w-6xl px-6">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Photos in this entry
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                {photos.length.toString().padStart(2, "0")}
              </div>
            </div>
          </div>
          <PhotoStrip
            photos={photos.map((p) => ({
              filePath: p.filePath,
              width: p.width,
              height: p.height,
            }))}
            duration={Math.max(40, photos.length * 6)}
            height={110}
          />
        </div>
      )}
    </footer>
  );
}

export function MagazinePageWithFooter(props: {
  layout: Layout;
  photos: DisplayPhoto[];
  createdAt?: Date;
}) {
  return (
    <>
      <MagazinePage {...props} />
      <EntryFooter photos={props.photos} />
    </>
  );
}

function Masthead({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="relative pb-12 pt-8 text-center sm:pt-16">
      <FadeIn delay={0.05}>
        <div className="mb-6 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
          <span className="h-px w-8 bg-zinc-300 dark:bg-zinc-700" />
          <span>Looseleaf · Entry</span>
          <span className="h-px w-8 bg-zinc-300 dark:bg-zinc-700" />
        </div>
      </FadeIn>
      <FadeIn delay={0.1} duration={1}>
        <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-7xl">
          {title}
        </h1>
      </FadeIn>
      <FadeIn delay={0.25} duration={0.9}>
        <p className="mx-auto mt-8 max-w-xl text-balance text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {intro}
        </p>
      </FadeIn>
    </header>
  );
}

function HeroBlock({
  block,
  photo,
}: {
  block: Extract<Block, { type: "hero" }>;
  photo: DisplayPhoto;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <FadeIn delay={0.35} duration={1.1}>
      <section className="-mx-6 sm:mx-0">
        <Tilt intensity={5} className="block">
          <div
            ref={ref}
            className="relative overflow-hidden bg-zinc-100 sm:rounded-xl dark:bg-zinc-900"
            style={{ aspectRatio: naturalAspect(photo, "4/3") }}
          >
          <motion.div
            className="absolute inset-0"
            style={reduced ? undefined : { y, scale: 1.08 }}
          >
            <PhotoImage
              src={photo.filePath}
              alt={block.headline}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 720px, 100vw"
              style={framingStyle(block.framing)}
              priority
            />
          </motion.div>
          {/* Rotating cog badge floats on top of the hero */}
          <div className="absolute bottom-4 right-4 hidden text-white/90 mix-blend-difference sm:block">
            <RotatingBadge size={84} iconSize={18} />
          </div>
          </div>
        </Tilt>
        {(block.headline || block.subhead) && (
          <div className="mt-8 px-6 sm:px-0">
            {block.headline && (
              <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
                {block.headline}
              </h2>
            )}
            {block.subhead && (
              <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
                {block.subhead}
              </p>
            )}
          </div>
        )}
      </section>
    </FadeIn>
  );
}

function BlockView({
  block,
  photos,
}: {
  block: Block;
  photos: DisplayPhoto[];
}) {
  switch (block.type) {
    case "hero": {
      // Hero is rendered above the fold by MagazinePage. If a layout somehow contains
      // a second hero block, fall back to a generic feature treatment.
      const photo = getPhoto(photos, block.photoIdx);
      if (!photo) return null;
      return (
        <section className="-mx-6 sm:mx-0">
          <div
            className="relative overflow-hidden bg-zinc-100 sm:rounded-xl dark:bg-zinc-900"
            style={{ aspectRatio: naturalAspect(photo, "4/3") }}
          >
            <PhotoImage
              src={photo.filePath}
              alt={block.headline}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 720px, 100vw"
              style={framingStyle(block.framing)}
            />
          </div>
        </section>
      );
    }
    case "text":
      return (
        <section className="text-lg leading-8 text-zinc-700 dark:text-zinc-300">
          <Markdown text={block.markdown} />
        </section>
      );
    case "photo": {
      const photo = getPhoto(photos, block.photoIdx);
      if (!photo) return null;
      const sizeWrapper =
        block.size === "small"
          ? "max-w-sm mx-auto"
          : block.size === "full"
          ? "-mx-6 sm:mx-0"
          : "max-w-xl mx-auto";
      const aspect =
        block.size === "small"
          ? "1 / 1"
          : naturalAspect(photo, block.size === "full" ? "4/5" : "4/3");
      return (
        <figure className={sizeWrapper}>
          <Tilt intensity={block.size === "small" ? 2 : 4} className="block">
            <div
              className="relative overflow-hidden bg-zinc-100 sm:rounded-xl dark:bg-zinc-900"
              style={{ aspectRatio: aspect, maxHeight: "85vh" }}
            >
              <PhotoImage
                src={photo.filePath}
                alt={block.caption ?? ""}
                fill
                className="object-cover"
                loading="eager"
                style={framingStyle(block.framing)}
                sizes={
                  block.size === "small"
                    ? "(min-width: 640px) 384px, 100vw"
                    : block.size === "full"
                    ? "(min-width: 640px) 720px, 100vw"
                    : "(min-width: 640px) 576px, 100vw"
                }
              />
            </div>
          </Tilt>
          {block.caption && (
            <figcaption className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "gallery": {
      const items: GalleryPhoto[] = block.photoIdxs
        .map((idx) => getPhoto(photos, idx))
        .filter((p): p is DisplayPhoto => p !== null);
      return (
        <Gallery
          photos={items}
          spans={block.spans}
          caption={block.caption}
          tilt
        />
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-2 border-zinc-900 pl-6 dark:border-zinc-100">
          <p className="font-serif text-3xl italic leading-snug tracking-tight sm:text-4xl">
            &ldquo;{block.text}&rdquo;
          </p>
          {block.attribution && (
            <footer className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );
  }
}
