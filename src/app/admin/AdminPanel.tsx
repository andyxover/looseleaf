"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { addEditor, removeEditor, type AddEditorState } from "./actions";

type Editor = { email: string; addedAt: string; addedBy: string };

const initial: AddEditorState = { error: null };

export function AdminPanel({ editors }: { editors: Editor[] }) {
  const [state, formAction, pending] = useActionState(addEditor, initial);

  return (
    <div className="mt-12 space-y-10">
      <form action={formAction} className="space-y-3">
        <label
          htmlFor="email"
          className="block font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500"
        >
          Add editor
        </label>
        <div className="flex gap-2">
          <input
            id="email"
            name="email"
            type="email"
            placeholder="someone@example.com"
            required
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-base outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </button>
        </div>
        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}
      </form>

      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
          Current editors ({editors.length.toString().padStart(2, "0")})
        </div>
        {editors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
            No editors yet. Add one above.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {editors.map((e) => (
              <EditorRow key={e.email} editor={e} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EditorRow({ editor }: { editor: Editor }) {
  const [pending, startTransition] = useTransition();
  const [confirmedOnce, setConfirmedOnce] = useState(false);

  function handleClick() {
    if (!confirmedOnce) {
      setConfirmedOnce(true);
      setTimeout(() => setConfirmedOnce(false), 3000);
      return;
    }
    startTransition(async () => {
      await removeEditor(editor.email);
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <div className="text-sm">{editor.email}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Added{" "}
          {new Date(editor.addedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          · by {editor.addedBy}
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition disabled:opacity-50 ${
          confirmedOnce
            ? "bg-red-600 text-white hover:bg-red-700"
            : "text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        }`}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        {confirmedOnce ? "Confirm" : "Remove"}
      </button>
    </li>
  );
}
