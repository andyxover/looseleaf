"use client";

import { useState } from "react";
import { Heart, Eye, MessageCircle, Pencil, Trash2, Loader2 } from "lucide-react";

import {
  toggleLike,
  addComment,
  editComment,
  deleteComment,
  type CommentDTO,
} from "@/app/engagement-actions";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PostEngagement({
  pageId,
  views,
  likeCount,
  liked,
  comments,
  isOwner,
}: {
  pageId: string;
  views: number;
  likeCount: number;
  liked: boolean;
  comments: CommentDTO[];
  isOwner: boolean;
}) {
  const [likes, setLikes] = useState(likeCount);
  const [isLiked, setIsLiked] = useState(liked);
  const [likeBusy, setLikeBusy] = useState(false);

  const [list, setList] = useState<CommentDTO[]>(comments);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // owner inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  async function onLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const next = !isLiked;
    setIsLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      const res = await toggleLike(pageId);
      setIsLiked(res.liked);
      setLikes(res.count);
    } catch {
      setIsLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    } finally {
      setLikeBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await addComment(pageId, name, body);
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setList((l) => [...l, res.comment]);
    setBody("");
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await deleteComment(id);
    if ("ok" in res) setList((l) => l.filter((c) => c.id !== id));
  }

  async function onSaveEdit(id: string) {
    const res = await editComment(id, editBody);
    if ("error" in res) return;
    setList((l) =>
      l.map((c) =>
        c.id === id ? { ...c, body: editBody.trim(), editedAt: res.editedAt } : c,
      ),
    );
    setEditingId(null);
  }

  return (
    <section className="mx-auto max-w-3xl px-6 pb-20 print:hidden">
      {/* Like + views bar */}
      <div className="flex items-center gap-5 border-y border-zinc-200 py-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={isLiked}
          className="group inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <Heart
            className={`size-5 transition ${
              isLiked
                ? "fill-accent text-accent"
                : "text-zinc-400 group-hover:text-accent"
            }`}
          />
          {likes}
          <span className="text-zinc-400">{likes === 1 ? "like" : "likes"}</span>
        </button>
        <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <Eye className="size-5 text-zinc-400" />
          {views.toLocaleString()}
          <span className="text-zinc-400">{views === 1 ? "view" : "views"}</span>
        </span>
      </div>

      {/* Comments */}
      <h3 className="mt-12 flex items-center gap-2 font-serif text-2xl tracking-tight">
        <MessageCircle className="size-5 text-zinc-400" />
        Comments
        <span className="font-sans text-base font-normal text-zinc-400">
          {list.length}
        </span>
      </h3>

      <ul className="mt-6 space-y-6">
        {list.length === 0 && (
          <li className="text-sm text-zinc-400">
            No comments yet — be the first.
          </li>
        )}
        {list.map((c) => (
          <li key={c.id} className="group border-b border-zinc-100 pb-5 dark:border-zinc-900">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {c.authorName}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">
                  {fmt(c.createdAt)}
                  {c.editedAt ? " · edited" : ""}
                </span>
              </div>
              {isOwner && editingId !== c.id && (
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditBody(c.body);
                    }}
                    className="grid size-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    aria-label="Edit comment"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="grid size-7 place-items-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
            {editingId === c.id ? (
              <div className="mt-2">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSaveEdit(c.id)}
                    className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
                {c.body}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Comment form */}
      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          maxLength={60}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add a comment…"
          maxLength={4000}
          className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-ink disabled:opacity-50"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Post comment
        </button>
      </form>
    </section>
  );
}
