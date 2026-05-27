"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

import { RichEditor } from "@/components/RichEditor";
import { updatePageLayout } from "@/app/journal/[id]/actions";
import type { Layout } from "@/lib/layout";

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

// Owner editor for "Build it myself" (richtext) posts — same Tiptap surface as
// creating, plus title + date. Saves back into the page's richtext block.
export function RichJournalEditor({
  pageId,
  initialLayout,
  initialEntryDate,
}: {
  pageId: string;
  initialLayout: Layout;
  initialEntryDate: string;
}) {
  const router = useRouter();
  const richBlock = initialLayout.blocks.find((b) => b.type === "richtext");
  const [title, setTitle] = useState(initialLayout.title);
  const [body, setBody] = useState(
    richBlock?.type === "richtext" ? richBlock.html : "",
  );
  const [entryDate, setEntryDate] = useState(initialEntryDate.slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    const layout: Layout = {
      title: title.trim() || "Untitled",
      intro: plainText(body),
      blocks: [{ type: "richtext", html: body }],
    };
    try {
      await updatePageLayout(pageId, layout, entryDate);
      setSaved(true);
      router.refresh();
    } catch (e) {
      console.error("save rich post failed", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setSaved(false);
        }}
        placeholder="Title"
        className="mb-4 w-full bg-transparent font-serif text-4xl tracking-tight outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
      />
      <input
        type="date"
        value={entryDate}
        onChange={(e) => {
          setEntryDate(e.target.value);
          setSaved(false);
        }}
        className="mb-6 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
      />
      <RichEditor
        initialHTML={body}
        onChange={(html) => {
          setBody(html);
          setSaved(false);
        }}
      />
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="size-4" />
              Saved
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </div>
  );
}
