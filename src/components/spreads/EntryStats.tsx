import { Heart, Eye } from "lucide-react";

// Tiny likes/views chip for feed cards. Server-safe (no interactivity).
export function EntryStats({
  likeCount,
  views,
  className = "",
}: {
  likeCount: number;
  views: number;
  className?: string;
}) {
  if (likeCount === 0 && views === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        <Heart className="size-3" />
        {likeCount.toLocaleString()}
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3" />
        {views.toLocaleString()}
      </span>
    </span>
  );
}
