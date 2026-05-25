"use client";

import { X, Replace } from "lucide-react";

import { PhotoImage } from "@/components/PhotoImage";
import { Tilt } from "@/components/Tilt";

export type GalleryPhoto = {
  filePath: string;
  width?: number | null;
  height?: number | null;
};

type GalleryEditing = {
  onRemovePhoto?: (idxInGallery: number) => void;
  onReplacePhoto?: (idxInGallery: number) => void;
  onResizePhoto?: (idxInGallery: number, span: number) => void;
};

export function Gallery({
  photos,
  caption,
  spans,
  editing,
  tilt = false,
}: {
  photos: GalleryPhoto[];
  caption?: string;
  spans?: number[];
  editing?: GalleryEditing;
  tilt?: boolean;
}) {
  if (photos.length === 0) return null;

  const useFlexibleGrid =
    spans !== undefined && spans.some((s) => s !== undefined && s !== 1);

  let desktopView: React.ReactNode;
  if (useFlexibleGrid) {
    desktopView = <FlexibleGrid photos={photos} spans={spans!} editing={editing} tilt={tilt} />;
  } else if (photos.length === 2) {
    desktopView = <PairAsymmetric photos={photos} editing={editing} tilt={tilt} />;
  } else if (photos.length === 3) {
    desktopView = <HeroPlusTwo photos={photos} editing={editing} tilt={tilt} />;
  } else if (photos.length === 4) {
    desktopView = <Bento4 photos={photos} editing={editing} tilt={tilt} />;
  } else {
    desktopView = <Masonry photos={photos} editing={editing} tilt={tilt} />;
  }

  // Mobile: always masonry (small screens can't make bento breathe) — but when
  // user has set custom spans, honour them via the flexible grid in mobile too.
  const mobileView = useFlexibleGrid ? (
    <FlexibleGrid photos={photos} spans={spans!} editing={editing} mobile tilt={tilt} />
  ) : (
    <Masonry photos={photos} editing={editing} tilt={tilt} />
  );

  return (
    <figure>
      <div className="sm:hidden">{mobileView}</div>
      <div className="hidden sm:block">{desktopView}</div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm italic text-zinc-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Tile({
  photo,
  sizes,
  editing,
  idx,
  span,
  tilt = false,
}: {
  photo: GalleryPhoto;
  sizes: string;
  editing?: GalleryEditing;
  idx: number;
  span?: number;
  tilt?: boolean;
}) {
  const inner = (
    <div className="group/photo relative h-full w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
      <PhotoImage
        src={photo.filePath}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        loading="eager"
      />
      {editing && <PhotoOverlay editing={editing} idx={idx} span={span} />}
    </div>
  );
  if (!tilt) return inner;
  return (
    <Tilt intensity={3} className="h-full w-full">
      {inner}
    </Tilt>
  );
}

function PhotoOverlay({
  editing,
  idx,
  span,
}: {
  editing: GalleryEditing;
  idx: number;
  span?: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between opacity-0 transition group-hover/photo:opacity-100">
      {editing.onResizePhoto ? (
        <SizeCycler
          current={span ?? 1}
          onChange={(s) => editing.onResizePhoto?.(idx, s)}
        />
      ) : (
        <div />
      )}
      <div className="flex gap-1">
        {editing.onReplacePhoto && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editing.onReplacePhoto?.(idx);
            }}
            className="pointer-events-auto grid size-7 place-items-center rounded-md bg-white/90 text-zinc-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-900"
            aria-label="Replace photo"
          >
            <Replace className="size-3.5" />
          </button>
        )}
        {editing.onRemovePhoto && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editing.onRemovePhoto?.(idx);
            }}
            className="pointer-events-auto grid size-7 place-items-center rounded-md bg-white/90 text-zinc-700 shadow-sm backdrop-blur transition hover:bg-red-50 hover:text-red-600"
            aria-label="Remove from gallery"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function SizeCycler({
  current,
  onChange,
}: {
  current: number;
  onChange: (s: number) => void;
}) {
  return (
    <div className="pointer-events-auto inline-flex overflow-hidden rounded-md bg-white/90 text-[10px] font-medium shadow-sm backdrop-blur dark:bg-zinc-900/90">
      {[1, 2, 3].map((s) => (
        <button
          key={s}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(s);
          }}
          className={`px-2 py-1 transition ${
            current === s
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
          aria-label={`Set size ${s}`}
        >
          {s === 1 ? "S" : s === 2 ? "M" : "L"}
        </button>
      ))}
    </div>
  );
}

function PairAsymmetric({
  photos,
  editing,
  tilt,
}: {
  photos: GalleryPhoto[];
  editing?: GalleryEditing;
  tilt?: boolean;
}) {
  return (
    <div className="grid aspect-[5/2] grid-cols-[3fr_2fr] gap-3">
      <Tile photo={photos[0]} sizes="432px" editing={editing} idx={0} tilt={tilt} />
      <Tile photo={photos[1]} sizes="288px" editing={editing} idx={1} tilt={tilt} />
    </div>
  );
}

function HeroPlusTwo({
  photos,
  editing,
  tilt,
}: {
  photos: GalleryPhoto[];
  editing?: GalleryEditing;
  tilt?: boolean;
}) {
  return (
    <div className="grid aspect-[3/2] grid-cols-[3fr_2fr] grid-rows-2 gap-3">
      <div className="relative row-span-2">
        <Tile photo={photos[0]} sizes="432px" editing={editing} idx={0} tilt={tilt} />
      </div>
      <div className="relative">
        <Tile photo={photos[1]} sizes="288px" editing={editing} idx={1} tilt={tilt} />
      </div>
      <div className="relative">
        <Tile photo={photos[2]} sizes="288px" editing={editing} idx={2} tilt={tilt} />
      </div>
    </div>
  );
}

function Bento4({
  photos,
  editing,
  tilt,
}: {
  photos: GalleryPhoto[];
  editing?: GalleryEditing;
  tilt?: boolean;
}) {
  return (
    <div className="grid aspect-[4/5] grid-cols-3 grid-rows-3 gap-3">
      <div className="relative col-span-2 row-span-2">
        <Tile photo={photos[0]} sizes="480px" editing={editing} idx={0} tilt={tilt} />
      </div>
      <div className="relative">
        <Tile photo={photos[1]} sizes="240px" editing={editing} idx={1} tilt={tilt} />
      </div>
      <div className="relative">
        <Tile photo={photos[2]} sizes="240px" editing={editing} idx={2} tilt={tilt} />
      </div>
      <div className="relative col-span-3">
        <Tile photo={photos[3]} sizes="720px" editing={editing} idx={3} tilt={tilt} />
      </div>
    </div>
  );
}

function Masonry({
  photos,
  editing,
  tilt,
}: {
  photos: GalleryPhoto[];
  editing?: GalleryEditing;
  tilt?: boolean;
}) {
  return (
    <div className="gap-3 [column-count:2] sm:[column-count:3]">
      {photos.map((p, i) => {
        const aspect =
          p.width && p.height ? `${p.width} / ${p.height}` : "1 / 1";
        const inner = (
          <div
            className="group/photo relative h-full w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900"
          >
            <PhotoImage
              src={p.filePath}
              alt=""
              width={p.width ?? 800}
              height={p.height ?? 800}
              sizes="(min-width: 640px) 240px, 50vw"
              className="block h-full w-full object-cover"
              loading="eager"
            />
            {editing && <PhotoOverlay editing={editing} idx={i} />}
          </div>
        );
        const wrapperStyle = { aspectRatio: aspect } as React.CSSProperties;
        const wrapperClass = "mb-3 break-inside-avoid";
        return tilt ? (
          <Tilt
            key={`${p.filePath}-${i}`}
            intensity={3}
            className={wrapperClass}
            style={wrapperStyle}
          >
            {inner}
          </Tilt>
        ) : (
          <div
            key={`${p.filePath}-${i}`}
            className={wrapperClass}
            style={wrapperStyle}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function FlexibleGrid({
  photos,
  spans,
  editing,
  mobile = false,
  tilt,
}: {
  photos: GalleryPhoto[];
  spans: number[];
  editing?: GalleryEditing;
  mobile?: boolean;
  tilt?: boolean;
}) {
  // Mobile uses a 3-col grid; desktop uses a 6-col grid. A photo's "size" maps
  // to how many columns/rows it occupies. Larger numbers = bigger tiles.
  const cols = mobile ? 3 : 6;
  const sizeToCols = (s: number) => Math.min(cols, s * (mobile ? 1 : 2));

  return (
    <div
      className="grid gap-3 [grid-auto-flow:dense]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {photos.map((p, i) => {
        const span = spans[i] ?? 1;
        const cellCols = sizeToCols(span);
        const cellRows = sizeToCols(span);
        const inner = (
          <div
            className="group/photo relative h-full w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900"
          >
            <PhotoImage
              src={p.filePath}
              alt=""
              fill
              sizes={
                mobile
                  ? `${(cellCols / cols) * 100}vw`
                  : `${(cellCols / cols) * 720}px`
              }
              className="object-cover"
              loading="eager"
            />
            {editing && <PhotoOverlay editing={editing} idx={i} span={span} />}
          </div>
        );
        const itemStyle: React.CSSProperties = {
          gridColumn: `span ${cellCols}`,
          gridRow: `span ${cellRows}`,
          aspectRatio: "1 / 1",
        };
        return tilt ? (
          <Tilt key={`${p.filePath}-${i}`} intensity={3} style={itemStyle}>
            {inner}
          </Tilt>
        ) : (
          <div key={`${p.filePath}-${i}`} style={itemStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
