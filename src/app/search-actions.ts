"use server";

import { prisma } from "@/lib/prisma";
import { getLang, resolveLayoutJson } from "@/lib/lang";

export type SearchResult = {
  id: string;
  title: string;
  date: string;
  cover: string | null;
  photoCount: number;
};

// Substring search across title + summary + both translations, so a query in
// either language finds the post regardless of its original language. Each
// result's title is shown in the viewer's current language.
export async function searchEntries(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const lang = await getLang();

  const rows = await prisma.page.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { layoutEn: { contains: q, mode: "insensitive" } },
        { layoutZh: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 25,
    include: {
      photos: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { photos: true } },
    },
  });

  return rows.map((p) => {
    let title = p.title;
    try {
      const t = JSON.parse(resolveLayoutJson(p, lang))?.title;
      if (typeof t === "string" && t.trim()) title = t;
    } catch {
      /* keep p.title */
    }
    return {
      id: p.id,
      title,
      date: p.entryDate.toISOString(),
      cover: p.photos[0]?.filePath ?? null,
      photoCount: p._count.photos,
    };
  });
}
