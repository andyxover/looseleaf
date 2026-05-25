"use server";

import { prisma } from "@/lib/prisma";
import { pageToEntry, type FeedEntry } from "@/lib/feed";

const PAGE_SIZE = 24;

// Cursor is the entryDate ISO string of the LAST entry returned in the
// previous page (we fetch entries strictly older than this).
export async function loadMoreEntries(
  cursorIso: string,
): Promise<{ entries: FeedEntry[]; nextCursor: string | null }> {
  const cursor = new Date(cursorIso);
  if (Number.isNaN(cursor.getTime())) {
    return { entries: [], nextCursor: null };
  }

  const rows = await prisma.page.findMany({
    where: { entryDate: { lt: cursor } },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: PAGE_SIZE,
    include: {
      photos: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { photos: true } },
    },
  });

  const entries: FeedEntry[] = rows.map((p) =>
    pageToEntry({
      id: p.id,
      title: p.title,
      entryDate: p.entryDate,
      layoutJson: p.layoutJson,
      photos: p.photos.map((ph) => ({ filePath: ph.filePath })),
      _photoCount: p._count.photos,
    }),
  );
  const nextCursor =
    rows.length === PAGE_SIZE
      ? rows[rows.length - 1].entryDate.toISOString()
      : null;
  return { entries, nextCursor };
}
