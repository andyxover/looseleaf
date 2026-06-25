"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, X, Upload, ArrowLeft } from "lucide-react";

import { createPage, createPageManual, type CreatePageState } from "./actions";
import { compressImage } from "@/lib/compress";
import { uploadToCloudinary } from "@/lib/cloudinary-client";
import { RichEditor } from "@/components/RichEditor";
import { MAX_PHOTOS } from "@/lib/limits";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  draftHasContent,
  markPendingCreate,
  clearPendingCreate,
} from "@/lib/draft";

type Preview = {
  localUrl: string;
  status: "preparing" | "uploading" | "uploaded" | "error";
  publicId?: string;
  width?: number;
  height?: number;
  error?: string;
};

const initialState: CreatePageState = { error: null };

function todayLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CreateForm() {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [summary, setSummary] = useState("");
  const [entryDate, setEntryDate] = useState(todayLocal);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [restored, setRestored] = useState(false);
  // Bumped on restore to remount RichEditor with the recovered HTML — TipTap
  // only reads initialHTML once, on mount.
  const [editorKey, setEditorKey] = useState(0);
  const hydratedRef = useRef(false);
  const submittingRef = useRef(false);

  // Restore a saved draft on first mount (after hydration, to avoid an SSR
  // mismatch). Empty drafts are ignored.
  useEffect(() => {
    const d = loadDraft();
    if (d && draftHasContent(d)) {
      setMode(d.mode);
      setTitle(d.title);
      setSummary(d.summary);
      setBody(d.body);
      if (d.entryDate) setEntryDate(d.entryDate);
      if (d.body.trim()) setEditorKey((k) => k + 1);
      setRestored(true);
    }
    hydratedRef.current = true;
  }, []);

  // Autosave the draft as the user types (debounced). Paused during submit so a
  // successful create — which clears the draft on the destination page — isn't
  // immediately re-saved.
  useEffect(() => {
    if (!hydratedRef.current || submittingRef.current) return;
    const draft = { mode, title, summary, body, entryDate };
    const t = setTimeout(() => {
      if (draftHasContent(draft)) saveDraft(draft);
      else clearDraft();
    }, 600);
    return () => clearTimeout(t);
  }, [mode, title, summary, body, entryDate]);

  function discardDraft() {
    clearDraft();
    setTitle("");
    setSummary("");
    setBody("");
    setEntryDate(todayLocal());
    setEditorKey((k) => k + 1);
    setRestored(false);
  }

  const inFlight = previews.filter(
    (p) => p.status === "preparing" || p.status === "uploading",
  ).length;
  const errored = previews.filter((p) => p.status === "error");
  const uploaded = previews.filter((p) => p.status === "uploaded");

  async function action(
    prev: CreatePageState,
    formData: FormData,
  ): Promise<CreatePageState> {
    formData.delete("photos");
    formData.set("title", title);
    formData.set("entryDate", entryDate);

    if (mode === "manual") {
      if (!title.trim()) return { error: "Give your entry a title." };
      // Inline images live in the body HTML; the server extracts them.
      formData.set("body", body);
      // Keep the draft saved through the request; on success the create
      // redirects to /journal/[id], where the marker clears it. Reaching past
      // the await means it returned an error, so re-enable autosave.
      submittingRef.current = true;
      markPendingCreate();
      const res = await createPageManual(prev, formData);
      submittingRef.current = false;
      clearPendingCreate();
      return res;
    }

    if (!summary.trim()) return { error: "Tell me what happened." };
    for (const p of uploaded) {
      formData.append(
        "photos",
        JSON.stringify({
          publicId: p.publicId,
          width: p.width,
          height: p.height,
        }),
      );
    }
    formData.set("summary", summary);
    submittingRef.current = true;
    markPendingCreate();
    const res = await createPage(prev, formData);
    submittingRef.current = false;
    clearPendingCreate();
    return res;
  }

  const [state, formAction, pending] = useActionState(action, initialState);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    // Reserve slots in state so we don't pass the cap before counting.
    const baseIdx = previews.length;
    const room = Math.max(0, MAX_PHOTOS - baseIdx);
    const toProcess = incoming.slice(0, room);

    // Pre-add placeholders so the UI shows the row immediately.
    setPreviews((p) => [
      ...p,
      ...toProcess.map((f) => ({
        localUrl: URL.createObjectURL(f),
        status: "preparing" as const,
      })),
    ]);

    // Process sequentially: compress → direct upload to Cloudinary.
    for (let i = 0; i < toProcess.length; i++) {
      const file = toProcess[i];
      const myIndex = baseIdx + i;
      try {
        const compressed = await compressImage(file);
        setPreviews((p) =>
          p.map((x, idx) =>
            idx === myIndex ? { ...x, status: "uploading" } : x,
          ),
        );
        const result = await uploadToCloudinary(compressed);
        setPreviews((p) =>
          p.map((x, idx) =>
            idx === myIndex
              ? {
                  ...x,
                  status: "uploaded",
                  publicId: result.publicId,
                  width: result.width,
                  height: result.height,
                }
              : x,
          ),
        );
      } catch (e) {
        setPreviews((p) =>
          p.map((x, idx) =>
            idx === myIndex
              ? {
                  ...x,
                  status: "error",
                  error: e instanceof Error ? e.message : "Upload failed",
                }
              : x,
          ),
        );
      }
    }
  }

  function removeAt(idx: number) {
    setPreviews((p) => {
      URL.revokeObjectURL(p[idx].localUrl);
      return p.filter((_, i) => i !== idx);
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <h1 className="mt-6 font-serif text-4xl tracking-tight">New entry</h1>
      <p className="mt-2 text-zinc-500">
        {mode === "ai"
          ? "Drop in some photos and tell me what happened. I’ll lay it out."
          : "Write your entry — paste or drop photos right into the text as you go."}
      </p>

      <div className="mt-6 inline-flex rounded-full border border-zinc-200 p-1 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMode("ai")}
          aria-pressed={mode === "ai"}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "ai"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          ✨ AI layout
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          aria-pressed={mode === "manual"}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "manual"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          ✍️ Build it myself
        </button>
      </div>

      {restored && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Restored your unsaved draft.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
          >
            Discard
          </button>
        </div>
      )}

      <form action={formAction} className="mt-8 space-y-8">
        {mode === "ai" && (
          <label
          htmlFor="photos-input"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 px-6 py-12 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        >
          <Upload className="size-6 text-zinc-400" />
          <div className="text-center">
            <div className="font-medium">
              {inFlight > 0
                ? `Uploading ${inFlight} photo${inFlight === 1 ? "" : "s"}…`
                : "Click to add photos"}
            </div>
            <div className="text-sm text-zinc-500">
              JPG, PNG, WebP, or GIF — up to {MAX_PHOTOS}. Skip to auto-generate an illustration.
            </div>
          </div>
          <input
            id="photos-input"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          </label>
        )}

        {mode === "ai" && previews.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((p, i) => (
              <div
                key={p.localUrl}
                className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900"
              >
                <Image
                  src={p.localUrl}
                  alt=""
                  fill
                  className={`object-cover transition ${
                    p.status === "uploaded" ? "opacity-100" : "opacity-50"
                  }`}
                  unoptimized
                />
                {p.status !== "uploaded" && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {p.status === "error" ? (
                      <span className="rounded bg-red-600 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-white">
                        Failed
                      </span>
                    ) : (
                      <Loader2 className="size-5 animate-spin text-zinc-700 dark:text-zinc-200" />
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {mode === "manual" && (
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A Purple Whirlwind Arrives…"
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-base outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </div>
        )}

        <div>
          <label htmlFor="entry-date" className="mb-2 block text-sm font-medium">
            When did it happen?
          </label>
          <input
            id="entry-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-base outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
        </div>

        {mode === "ai" ? (
          <div>
            <label htmlFor="summary" className="mb-2 block text-sm font-medium">
              What happened?
            </label>
            <textarea
              id="summary"
              rows={6}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Friday after school we walked to the park with Maya and Jules. The light was perfect and we stayed until it got cold. Maya brought her film camera. We talked about..."
              className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base leading-7 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-sm font-medium">Your story</label>
            <RichEditor key={editorKey} initialHTML={body} onChange={setBody} />
          </div>
        )}

        {errored.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {errored.length} photo{errored.length === 1 ? "" : "s"} failed to upload — remove or retry.
          </div>
        )}
        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || inFlight > 0}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {mode === "ai" ? "Designing your page…" : "Creating…"}
            </>
          ) : mode === "ai" ? (
            "Generate page"
          ) : (
            "Publish entry"
          )}
        </button>
      </form>
    </div>
  );
}
