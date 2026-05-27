import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { isOwner } from "@/lib/owner";
import { TimelineGrid, type TimelineEntry } from "@/components/TimelineGrid";

export const metadata = { title: "Timeline — Looseleaf" };

export default async function TimelinePage() {
  const admin = await isOwner();
  const rows = await prisma.page.findMany({
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      entryDate: true,
      photos: { take: 1, orderBy: { order: "asc" }, select: { filePath: true } },
    },
  });
  const entries: TimelineEntry[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.entryDate.toISOString(),
    cover: r.photos[0]?.filePath ?? null,
  }));

  return (
    <div className="relative z-10">
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
          Timeline
          <span className="ml-2 text-zinc-400">{entries.length}</span>
        </span>
      </header>
      <TimelineGrid entries={entries} isOwner={admin} />
    </div>
  );
}
