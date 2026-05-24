"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, X, Upload, ArrowLeft } from "lucide-react";

import { createPage, type CreatePageState } from "./actions";

type Preview = { file: File; url: string };

const initialState: CreatePageState = { error: null };

export default function CreateForm() {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [summary, setSummary] = useState("");

  async function action(
    prev: CreatePageState,
    formData: FormData,
  ): Promise<CreatePageState> {
    if (previews.length === 0) return { error: "Add at least one photo." };
    if (!summary.trim()) return { error: "Tell me what happened." };
    formData.delete("photos");
    for (const { file } of previews) {
      formData.append("photos", file);
    }
    formData.set("summary", summary);
    return createPage(prev, formData);
  }

  const [state, formAction, pending] = useActionState(action, initialState);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Preview[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setPreviews((p) => [...p, ...next].slice(0, 100));
  }

  function removeAt(idx: number) {
    setPreviews((p) => {
      URL.revokeObjectURL(p[idx].url);
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
        Drop in some photos and tell me what happened. I&apos;ll lay it out.
      </p>

      <form action={formAction} className="mt-10 space-y-8">
        <label
          htmlFor="photos-input"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 px-6 py-12 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        >
          <Upload className="size-6 text-zinc-400" />
          <div className="text-center">
            <div className="font-medium">Click to add photos</div>
            <div className="text-sm text-zinc-500">
              JPG, PNG, WebP, or GIF — up to 100
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

        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((p, i) => (
              <div
                key={p.url}
                className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900"
              >
                <Image src={p.url} alt="" fill className="object-cover" unoptimized />
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

        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Designing your page…
            </>
          ) : (
            "Generate page"
          )}
        </button>
      </form>
    </div>
  );
}
