"use client";

import { useState } from "react";
import { Heart, Eye, Share2, Check } from "lucide-react";

import { toggleLike } from "@/app/engagement-actions";

// Interactive like/views/share chip for feed cards. The card itself is a link,
// so each button stops the click from bubbling up to the card navigation.
export function FeedActions({
  pageId,
  title,
  likeCount,
  liked,
  views,
  className = "",
}: {
  pageId: string;
  title: string;
  likeCount: number;
  liked: boolean;
  views: number;
  className?: string;
}) {
  const [count, setCount] = useState(likeCount);
  const [isLiked, setIsLiked] = useState(liked);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function onLike(e: React.MouseEvent) {
    stop(e);
    if (busy) return;
    setBusy(true);
    const next = !isLiked;
    setIsLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const r = await toggleLike(pageId);
      setIsLiked(r.liked);
      setCount(r.count);
    } catch {
      setIsLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  async function onShare(e: React.MouseEvent) {
    stop(e);
    const url = `${window.location.origin}/journal/${pageId}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] ${className}`}
    >
      <button
        type="button"
        onClick={onLike}
        aria-pressed={isLiked}
        aria-label={isLiked ? "Unlike" : "Like"}
        className="inline-flex items-center gap-1 transition hover:opacity-70"
      >
        <Heart
          className={`size-3 transition ${isLiked ? "fill-accent text-accent" : ""}`}
        />
        {count.toLocaleString()}
      </button>
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3" />
        {views.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={onShare}
        aria-label="Share"
        className="inline-flex items-center gap-1 transition hover:opacity-70"
      >
        {copied ? <Check className="size-3" /> : <Share2 className="size-3" />}
      </button>
    </span>
  );
}
