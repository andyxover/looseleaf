"use server";

import { prisma } from "@/lib/prisma";

export type SearchResult = {
  id: string;
  title: string;
  date: string;
  cover: string | null;
  photoCount: number;
};

// Substring search over title + summary. summary holds the original post text
// (we stored "[hint] <original body>" at import), so this covers title + body.
// ILIKE substring matching works fine for mixed Chinese/English without needing
// language-specific tokenization.
export async function searchEntries(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await prisma.page.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 25,
    include: {
      photos: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { photos: true } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    date: p.entryDate.toISOString(),
    cover: p.photos[0]?.filePath ?? null,
    photoCount: p._count.photos,
  }));
}
