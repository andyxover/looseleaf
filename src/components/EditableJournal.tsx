"use client";

import { useState, useTransition, useRef, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";

import { PhotoImage } from "@/components/PhotoImage";
import {
  GripVertical,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Trash,
  Printer,
  Plus,
  Replace,
  Crop,
} from "lucide-react";

import type { Block, Framing, Layout } from "@/lib/layout";
import { DEFAULT_FRAMING } from "@/lib/layout";
import { MagazinePage, MagazinePageWithFooter } from "@/components/MagazinePage";
import { Gallery, type GalleryPhoto } from "@/components/Gallery";
import {
  updatePageLayout,
  deletePage,
  addPhotosToPage,
} from "@/app/journal/[id]/actions";

type Photo = {
  filePath: string;
  order: number;
  width?: number | null;
  height?: number | null;
};

function getPhoto(photos: Photo[], idx: number): Photo | null {
  return photos.find((p) => p.order === idx - 1) ?? null;
}

function naturalAspect(photo: Photo, fallback: string): string {
  if (photo.width && photo.height) return `${photo.width} / ${photo.height}`;
  return fallback;
}

function framingStyle(f: Framing | undefined): React.CSSProperties {
  if (!f) return {};
  if (f.x === 0.5 && f.y === 0.5 && f.scale === 1) return {};
  return {
    objectPosition: `${f.x * 100}% ${f.y * 100}%`,
    transform: `scale(${f.scale})`,
    transformOrigin: `${f.x * 100}% ${f.y * 100}%`,
  };
}

type PickerTarget = { blockIdx: number; gallerySlot?: number } | null;

export function EditableJournal({
  pageId,
  initialLayout,
  photos,
  createdAt,
}: {
  pageId: string;
  initialLayout: Layout;
  photos: Photo[];
  createdAt?: Date;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [savedLayout, setSavedLayout] = useState<Layout>(initialLayout);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [activeFramingBlock, setActiveFramingBlock] = useState<number | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);

  function save() {
    startSaving(async () => {
      await updatePageLayout(pageId, layout);
      setSavedLayout(layout);
      setMode("view");
    });
  }

  function cancel() {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setLayout(savedLayout);
    setMode("view");
  }

  function confirmDelete() {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    startDeleting(async () => {
      await deletePage(pageId);
    });
  }

  const [preparingPrint, setPreparingPrint] = useState(false);
  async function handlePrint() {
    setPreparingPrint(true);
    try {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
      await new Promise((r) => setTimeout(r, 50));
      window.print();
    } finally {
      setPreparingPrint(false);
    }
  }

  async function handleAdd(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAdding(true);
    setAddError(null);

    // Commit any pending edits before adding (server will append to the saved layout).
    if (dirty) {
      await updatePageLayout(pageId, layout);
      setSavedLayout(layout);
    }

    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("photos", f);
    const result = await addPhotosToPage(pageId, { error: null }, fd);
    if (e.target) e.target.value = "";

    if (result.error) {
      setAddError(result.error);
      setAdding(false);
      return;
    }
    router.refresh();
    setAdding(false);
  }

  function openPicker(blockIdx: number, gallerySlot?: number) {
    setPicker({ blockIdx, gallerySlot });
  }

  function selectPhotoForPicker(photoOrder: number) {
    if (!picker) return;
    const newPhotoIdx = photoOrder + 1; // 1-based
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== picker.blockIdx) return b;
        if (b.type === "photo") return { ...b, photoIdx: newPhotoIdx };
        if (b.type === "hero") return { ...b, photoIdx: newPhotoIdx };
        if (b.type === "gallery" && picker.gallerySlot !== undefined) {
          return {
            ...b,
            photoIdxs: b.photoIdxs.map((idx, slot) =>
              slot === picker.gallerySlot ? newPhotoIdx : idx,
            ),
          };
        }
        return b;
      }),
    }));
    setPicker(null);
  }

  function removeFromGallery(blockIdx: number, gallerySlot: number) {
    setLayout((prev) => {
      const next: Layout = {
        ...prev,
        blocks: prev.blocks
          .map((b, i) => {
            if (i !== blockIdx) return b;
            if (b.type !== "gallery") return b;
            return {
              ...b,
              photoIdxs: b.photoIdxs.filter((_, slot) => slot !== gallerySlot),
              spans: b.spans?.filter((_, slot) => slot !== gallerySlot),
            };
          })
          // Drop empty galleries automatically.
          .filter((b) => !(b.type === "gallery" && b.photoIdxs.length === 0)),
      };
      return next;
    });
  }

  function setFramingOnBlock(blockIdx: number, framing: Framing) {
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== blockIdx) return b;
        if (b.type === "photo" || b.type === "hero") return { ...b, framing };
        return b;
      }),
    }));
  }

  function setSpanInGallery(blockIdx: number, gallerySlot: number, span: number) {
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== blockIdx || b.type !== "gallery") return b;
        const current =
          b.spans ?? new Array(b.photoIdxs.length).fill(1);
        const nextSpans = [...current];
        nextSpans[gallerySlot] = span;
        // Drop spans entirely if all are 1 (lets us fall back to bento defaults).
        const allOne = nextSpans.every((s) => s === 1);
        return { ...b, spans: allOne ? undefined : nextSpans };
      }),
    }));
  }

  // Cmd/Ctrl+S to save while editing.
  useEffect(() => {
    if (mode !== "edit") return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !saving) save();
      }
      if (e.key === "Escape") {
        if (picker) {
          setPicker(null);
          return;
        }
        if (activeFramingBlock !== null) {
          setActiveFramingBlock(null);
          return;
        }
        const target = e.target as HTMLElement | null;
        if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") {
          (target as HTMLElement).blur();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dirty, saving, layout, picker, activeFramingBlock]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <>
      <Toolbar
        mode={mode}
        dirty={dirty}
        saving={saving}
        deleting={deleting}
        adding={adding}
        preparingPrint={preparingPrint}
        onEdit={() => setMode("edit")}
        onSave={save}
        onCancel={cancel}
        onDelete={confirmDelete}
        onPrint={handlePrint}
        onAddPhotos={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleAdd}
      />
      {addError && (
        <div className="mx-auto -mt-3 mb-3 max-w-3xl px-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {addError}
          </div>
        </div>
      )}
      {mode === "view" ? (
        <MagazinePageWithFooter
          layout={layout}
          photos={photos}
          createdAt={createdAt}
        />
      ) : (
        <MagazineEditor
          layout={layout}
          photos={photos}
          activeFramingBlock={activeFramingBlock}
          onChange={setLayout}
          onReplacePhoto={openPicker}
          onRemoveFromGallery={removeFromGallery}
          onSetSpanInGallery={setSpanInGallery}
          onStartFraming={(blockIdx) => setActiveFramingBlock(blockIdx)}
          onUpdateFraming={setFramingOnBlock}
          onExitFraming={() => setActiveFramingBlock(null)}
        />
      )}
      <PhotoPicker
        open={picker !== null}
        photos={photos}
        onSelect={selectPhotoForPicker}
        onClose={() => setPicker(null)}
      />
    </>
  );
}

function Toolbar({
  mode,
  dirty,
  saving,
  deleting,
  adding,
  preparingPrint,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onPrint,
  onAddPhotos,
}: {
  mode: "view" | "edit";
  dirty: boolean;
  saving: boolean;
  deleting: boolean;
  adding: boolean;
  preparingPrint: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onPrint: () => void;
  onAddPhotos: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 -mt-6 mb-6 border-b border-zinc-200 bg-white/80 backdrop-blur print:hidden dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-6 py-3">
        {mode === "view" ? (
          <>
            <button
              onClick={onPrint}
              disabled={preparingPrint}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {preparingPrint ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              {preparingPrint ? "Preparing…" : "Print / PDF"}
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash className="size-4" />
              )}
              Delete
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onAddPhotos}
              disabled={adding}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {adding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {adding ? "Uploading…" : "Add photos"}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100"
            >
              <X className="size-4" />
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {saving ? "Saving…" : dirty ? "Save" : "Saved"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MagazineEditor({
  layout,
  photos,
  activeFramingBlock,
  onChange,
  onReplacePhoto,
  onRemoveFromGallery,
  onSetSpanInGallery,
  onStartFraming,
  onUpdateFraming,
  onExitFraming,
}: {
  layout: Layout;
  photos: Photo[];
  activeFramingBlock: number | null;
  onChange: (next: Layout) => void;
  onReplacePhoto: (blockIdx: number, gallerySlot?: number) => void;
  onRemoveFromGallery: (blockIdx: number, gallerySlot: number) => void;
  onSetSpanInGallery: (blockIdx: number, gallerySlot: number, span: number) => void;
  onStartFraming: (blockIdx: number) => void;
  onUpdateFraming: (blockIdx: number, framing: Framing) => void;
  onExitFraming: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = Number(String(active.id).replace("block-", ""));
    const newIdx = Number(String(over.id).replace("block-", ""));
    onChange({ ...layout, blocks: arrayMove(layout.blocks, oldIdx, newIdx) });
  }

  function updateBlock(idx: number, patch: Partial<Block>) {
    onChange({
      ...layout,
      blocks: layout.blocks.map((b, i) =>
        i === idx ? ({ ...b, ...patch } as Block) : b,
      ),
    });
  }

  function deleteBlock(idx: number) {
    onChange({ ...layout, blocks: layout.blocks.filter((_, i) => i !== idx) });
  }

  const ids = layout.blocks.map((_, i) => `block-${i}`);

  return (
    <article className="mx-auto max-w-3xl px-6 pb-24">
      <header className="mb-16 text-center">
        <EditableText
          value={layout.title}
          onChange={(v) => onChange({ ...layout, title: v })}
          className="font-serif text-5xl leading-tight tracking-tight sm:text-6xl"
          placeholder="Title"
        />
        <EditableText
          value={layout.intro}
          onChange={(v) => onChange({ ...layout, intro: v })}
          className="mx-auto mt-6 max-w-xl text-balance text-lg leading-8 text-zinc-600 dark:text-zinc-400"
          placeholder="Short intro"
          multiline
        />
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-8">
            {layout.blocks.map((block, i) => (
              <SortableBlock
                key={`block-${i}`}
                id={`block-${i}`}
                block={block}
                blockIdx={i}
                photos={photos}
                framingActive={activeFramingBlock === i}
                onChange={(patch) => updateBlock(i, patch)}
                onDelete={() => deleteBlock(i)}
                onReplacePhoto={onReplacePhoto}
                onRemoveFromGallery={onRemoveFromGallery}
                onSetSpanInGallery={onSetSpanInGallery}
                onStartFraming={onStartFraming}
                onUpdateFraming={onUpdateFraming}
                onExitFraming={onExitFraming}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </article>
  );
}

function SortableBlock({
  id,
  block,
  blockIdx,
  photos,
  framingActive,
  onChange,
  onDelete,
  onReplacePhoto,
  onRemoveFromGallery,
  onSetSpanInGallery,
  onStartFraming,
  onUpdateFraming,
  onExitFraming,
}: {
  id: string;
  block: Block;
  blockIdx: number;
  photos: Photo[];
  framingActive: boolean;
  onChange: (patch: Partial<Block>) => void;
  onDelete: () => void;
  onReplacePhoto: (blockIdx: number, gallerySlot?: number) => void;
  onRemoveFromGallery: (blockIdx: number, gallerySlot: number) => void;
  onSetSpanInGallery: (blockIdx: number, gallerySlot: number, span: number) => void;
  onStartFraming: (blockIdx: number) => void;
  onUpdateFraming: (blockIdx: number, framing: Framing) => void;
  onExitFraming: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg transition ${
        isDragging
          ? "ring-2 ring-zinc-900 dark:ring-zinc-100 shadow-2xl"
          : "ring-0"
      }`}
    >
      <div className="absolute -left-12 top-1 hidden flex-col gap-1 sm:flex">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="grid size-8 cursor-grab touch-none place-items-center rounded-md text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-900 group-hover:opacity-100 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          onClick={onDelete}
          type="button"
          className="grid size-8 place-items-center rounded-md text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950"
          aria-label="Delete block"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-1 sm:hidden">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="grid size-7 cursor-grab touch-none place-items-center rounded-md bg-white/80 text-zinc-500 shadow-sm backdrop-blur active:cursor-grabbing dark:bg-zinc-900/80 dark:text-zinc-400"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          type="button"
          className="grid size-7 place-items-center rounded-md bg-white/80 text-zinc-500 shadow-sm backdrop-blur hover:text-red-600 dark:bg-zinc-900/80 dark:text-zinc-400"
          aria-label="Delete block"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <BlockEditor
        block={block}
        blockIdx={blockIdx}
        photos={photos}
        framingActive={framingActive}
        onChange={onChange}
        onReplacePhoto={onReplacePhoto}
        onRemoveFromGallery={onRemoveFromGallery}
        onSetSpanInGallery={onSetSpanInGallery}
        onStartFraming={onStartFraming}
        onUpdateFraming={onUpdateFraming}
        onExitFraming={onExitFraming}
      />
    </div>
  );
}

function BlockEditor({
  block,
  blockIdx,
  photos,
  framingActive,
  onChange,
  onReplacePhoto,
  onRemoveFromGallery,
  onSetSpanInGallery,
  onStartFraming,
  onUpdateFraming,
  onExitFraming,
}: {
  block: Block;
  blockIdx: number;
  photos: Photo[];
  framingActive: boolean;
  onChange: (patch: Partial<Block>) => void;
  onReplacePhoto: (blockIdx: number, gallerySlot?: number) => void;
  onRemoveFromGallery: (blockIdx: number, gallerySlot: number) => void;
  onSetSpanInGallery: (blockIdx: number, gallerySlot: number, span: number) => void;
  onStartFraming: (blockIdx: number) => void;
  onUpdateFraming: (blockIdx: number, framing: Framing) => void;
  onExitFraming: () => void;
}) {
  switch (block.type) {
    case "hero": {
      const photo = getPhoto(photos, block.photoIdx);
      if (!photo) return <MissingPhotoNotice onReplace={() => onReplacePhoto(blockIdx)} />;
      return (
        <section className="-mx-6 sm:mx-0">
          <div
            className="group/photo relative overflow-hidden bg-zinc-100 sm:rounded-lg dark:bg-zinc-900"
            style={{ aspectRatio: naturalAspect(photo, "4/3") }}
          >
            <PhotoImage
              src={photo.filePath}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 640px) 720px, 100vw"
              loading="eager"
              style={framingStyle(block.framing)}
            />
            <SinglePhotoReplaceButton onClick={() => onReplacePhoto(blockIdx)} />
          </div>
          <div className="mt-6 px-6 sm:px-0">
            <EditableText
              value={block.headline}
              onChange={(v) => onChange({ headline: v })}
              className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl"
              placeholder="Headline"
            />
            <EditableText
              value={block.subhead ?? ""}
              onChange={(v) => onChange({ subhead: v })}
              className="mt-3 text-lg text-zinc-600 dark:text-zinc-400"
              placeholder="Subhead (optional)"
              multiline
            />
          </div>
        </section>
      );
    }
    case "text":
      return (
        <section className="text-lg leading-8 text-zinc-800 dark:text-zinc-200">
          <EditableText
            value={block.markdown}
            onChange={(v) => onChange({ markdown: v })}
            className="text-lg leading-8"
            placeholder="Write something…"
            multiline
          />
        </section>
      );
    case "photo": {
      const photo = getPhoto(photos, block.photoIdx);
      if (!photo) return <MissingPhotoNotice onReplace={() => onReplacePhoto(blockIdx)} />;
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
      const framing = block.framing ?? DEFAULT_FRAMING;
      return (
        <figure className={sizeWrapper}>
          {framingActive ? (
            <FramingActivePhoto
              src={photo.filePath}
              sizes="(min-width: 640px) 720px, 100vw"
              containerStyle={{ aspectRatio: aspect, maxHeight: "85vh" }}
              containerClassName="sm:rounded-lg"
              framing={framing}
              onChange={(f) => onUpdateFraming(blockIdx, f)}
              onExit={onExitFraming}
            />
          ) : (
            <div
              className="group/photo relative overflow-hidden bg-zinc-100 sm:rounded-lg dark:bg-zinc-900"
              style={{ aspectRatio: aspect, maxHeight: "85vh" }}
            >
              <PhotoImage
                src={photo.filePath}
                alt=""
                fill
                className="object-cover"
                sizes="(min-width: 640px) 720px, 100vw"
                loading="eager"
                style={framingStyle(block.framing)}
              />
              <PhotoBlockOverlay
                onFrame={() => onStartFraming(blockIdx)}
                onReplace={() => onReplacePhoto(blockIdx)}
              />
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-3">
            <SizePicker
              value={block.size}
              onChange={(size) => onChange({ size })}
            />
          </div>
          <EditableText
            value={block.caption ?? ""}
            onChange={(v) => onChange({ caption: v })}
            className="mt-1 text-center text-sm italic text-zinc-500"
            placeholder="Caption (optional)"
          />
        </figure>
      );
    }
    case "gallery": {
      const items: GalleryPhoto[] = block.photoIdxs
        .map((idx) => getPhoto(photos, idx))
        .filter((p): p is Photo => p !== null);
      return (
        <div>
          <Gallery
            photos={items}
            spans={block.spans}
            editing={{
              onRemovePhoto: (slot) => onRemoveFromGallery(blockIdx, slot),
              onReplacePhoto: (slot) => onReplacePhoto(blockIdx, slot),
              onResizePhoto: (slot, span) =>
                onSetSpanInGallery(blockIdx, slot, span),
            }}
          />
          <EditableText
            value={block.caption ?? ""}
            onChange={(v) => onChange({ caption: v })}
            className="mt-3 text-center text-sm italic text-zinc-500"
            placeholder="Caption (optional)"
          />
        </div>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-2 border-zinc-900 pl-6 dark:border-zinc-100">
          <EditableText
            value={block.text}
            onChange={(v) => onChange({ text: v })}
            className="font-serif text-2xl italic leading-snug tracking-tight sm:text-3xl"
            placeholder="Pull quote"
            multiline
          />
          <EditableText
            value={block.attribution ?? ""}
            onChange={(v) => onChange({ attribution: v })}
            className="mt-3 text-sm text-zinc-500"
            placeholder="— attribution (optional)"
          />
        </blockquote>
      );
  }
}

function PhotoBlockOverlay({
  onFrame,
  onReplace,
}: {
  onFrame: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover/photo:opacity-100">
      <button
        type="button"
        onClick={onFrame}
        className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur transition hover:bg-white"
        aria-label="Adjust framing"
      >
        <Crop className="size-3.5" />
        Frame
      </button>
      <button
        type="button"
        onClick={onReplace}
        className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur transition hover:bg-white"
        aria-label="Replace photo"
      >
        <Replace className="size-3.5" />
        Replace
      </button>
    </div>
  );
}

function FramingActivePhoto({
  src,
  sizes,
  containerStyle,
  containerClassName = "",
  framing,
  onChange,
  onExit,
}: {
  src: string;
  sizes: string;
  containerStyle: React.CSSProperties;
  containerClassName?: string;
  framing: Framing;
  onChange: (f: Framing) => void;
  onExit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startFx: number;
    startFy: number;
  } | null>(null);

  // Wheel listener attached natively (non-passive) so we can preventDefault.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const newScale = Math.max(
        1,
        Math.min(3, framing.scale * (1 - e.deltaY * 0.002)),
      );
      onChange({ ...framing, scale: newScale });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [framing, onChange]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const dx = (e.clientX - d.startX) / rect.width;
      const dy = (e.clientY - d.startY) / rect.height;
      onChange({
        ...framing,
        x: Math.max(0, Math.min(1, d.startFx - dx)),
        y: Math.max(0, Math.min(1, d.startFy - dy)),
      });
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [framing, onChange]);

  function onMouseDown(e: React.MouseEvent) {
    // Don't start drag if clicking the toolbar.
    if ((e.target as HTMLElement).closest("[data-framing-toolbar]")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFx: framing.x,
      startFy: framing.y,
    };
  }

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      style={containerStyle}
      className={`relative cursor-grab overflow-hidden bg-zinc-100 ring-2 ring-blue-500 active:cursor-grabbing dark:bg-zinc-900 ${containerClassName}`}
    >
      <PhotoImage
        src={src}
        alt=""
        fill
        sizes={sizes}
        className="pointer-events-none object-cover select-none"
        loading="eager"
        draggable={false}
        style={framingStyle(framing)}
      />
      <div
        data-framing-toolbar
        className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 bg-white/95 px-3 py-2 text-sm backdrop-blur dark:bg-zinc-900/95"
      >
        <div className="text-xs text-zinc-500">
          {Math.round(framing.scale * 100)}% · drag to pan · scroll to zoom
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(DEFAULT_FRAMING);
            }}
            className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SinglePhotoReplaceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-sm opacity-0 backdrop-blur transition group-hover/photo:opacity-100 hover:bg-white"
      aria-label="Replace photo"
    >
      <Replace className="size-3.5" />
      Replace
    </button>
  );
}

function MissingPhotoNotice({ onReplace }: { onReplace: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
      <span>Photo missing.</span>
      <button
        type="button"
        onClick={onReplace}
        className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        <Replace className="size-3.5" />
        Pick a photo
      </button>
    </div>
  );
}

function SizePicker({
  value,
  onChange,
}: {
  value: "small" | "medium" | "full";
  onChange: (size: "small" | "medium" | "full") => void;
}) {
  const sizes: Array<"small" | "medium" | "full"> = ["small", "medium", "full"];
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-zinc-200 text-xs dark:border-zinc-800">
      {sizes.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`px-3 py-1 capitalize transition ${
            value === s
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function EditableText({
  value,
  onChange,
  className,
  placeholder,
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      spellCheck
      className={`block w-full resize-none border-none bg-transparent outline-none ring-0 transition placeholder:text-zinc-300 focus:bg-zinc-50 dark:placeholder:text-zinc-700 dark:focus:bg-zinc-900 rounded px-1 -mx-1 min-h-[1.4em] ${
        multiline ? "" : "overflow-hidden"
      } ${className}`}
      style={
        className.includes("text-center") ? { textAlign: "center" } : undefined
      }
    />
  );
}

function PhotoPicker({
  open,
  photos,
  onSelect,
  onClose,
}: {
  open: boolean;
  photos: Photo[];
  onSelect: (order: number) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 sm:p-12"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Pick a photo</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {photos
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((p) => (
              <button
                key={p.filePath}
                type="button"
                onClick={() => onSelect(p.order)}
                className="group/p relative aspect-square overflow-hidden rounded-md bg-zinc-100 ring-zinc-900 transition hover:ring-2 dark:bg-zinc-900 dark:ring-zinc-100"
              >
                <PhotoImage
                  src={p.filePath}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover transition group-hover/p:scale-105"
                />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
