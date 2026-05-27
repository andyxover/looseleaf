import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { EditableJournal } from "@/components/EditableJournal";
import { MagazinePageWithFooter } from "@/components/MagazinePage";
import { LangToggle } from "@/components/LangToggle";
import { PostEngagement } from "@/components/PostEngagement";
import { ViewCounter } from "@/components/ViewCounter";
import { ensureDimensions } from "@/lib/ensure-dimensions";
import { isEditor, isOwner } from "@/lib/owner";
import { getLang, resolveLayoutJson } from "@/lib/lang";
import type { Layout } from "@/lib/layout";
import type { CommentDTO } from "@/app/engagement-actions";

// Same reasoning as /create: `addPhotosToPage` does the same heavy pipeline.
export const maxDuration = 300;

export default async function JournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await prisma.page.findUnique({
    where: { id },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  if (!page) notFound();

  const [editor, admin, lang] = await Promise.all([
    isEditor(),
    isOwner(),
    getLang(),
  ]);
  // The editor works on the canonical source layout; readers see the
  // language-resolved translation (falls back to canonical if not translated).
  const canonical = JSON.parse(page.layoutJson) as Layout;
  const readLayout = JSON.parse(resolveLayoutJson(page, lang)) as Layout;
  const filled = await ensureDimensions(page.photos);
  const photos = filled.map((p) => ({
    filePath: p.filePath,
    order: p.order,
    width: p.width,
    height: p.height,
  }));

  // Engagement: like count, whether this anonymous visitor already liked, and
  // the comment thread.
  const jar = await cookies();
  const visitorId = jar.get("lv_visitor")?.value ?? null;
  const [likeCount, likedRow, commentRows] = await Promise.all([
    prisma.like.count({ where: { pageId: id } }),
    visitorId
      ? prisma.like.findUnique({
          where: { pageId_visitorId: { pageId: id, visitorId } },
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { pageId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const comments: CommentDTO[] = commentRows.map((c) => ({
    id: c.id,
    authorName: c.authorName,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt ? c.editedAt.toISOString() : null,
  }));

  return (
    <div>
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 pt-6 print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          All entries
        </Link>
        <LangToggle initial={lang} />
      </nav>
      {editor ? (
        <EditableJournal
          key={`${photos.length}-${page.layoutJson.length}`}
          pageId={id}
          initialLayout={canonical}
          photos={photos}
          initialEntryDate={page.entryDate.toISOString()}
        />
      ) : (
        <MagazinePageWithFooter
          layout={readLayout}
          photos={photos}
          createdAt={page.entryDate}
        />
      )}

      <ViewCounter pageId={id} skip={editor} />
      <PostEngagement
        pageId={id}
        views={page.views}
        likeCount={likeCount}
        liked={!!likedRow}
        comments={comments}
        isOwner={admin}
      />
    </div>
  );
}
