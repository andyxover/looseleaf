import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { EditableJournal } from "@/components/EditableJournal";
import { MagazinePageWithFooter } from "@/components/MagazinePage";
import { ensureDimensions } from "@/lib/ensure-dimensions";
import { isEditor } from "@/lib/owner";
import type { Layout } from "@/lib/layout";

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

  const layout = JSON.parse(page.layoutJson) as Layout;
  const filled = await ensureDimensions(page.photos);
  const photos = filled.map((p) => ({
    filePath: p.filePath,
    order: p.order,
    width: p.width,
    height: p.height,
  }));
  const owner = await isEditor();

  return (
    <div>
      <nav className="mx-auto max-w-3xl px-6 pt-6 print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          All entries
        </Link>
      </nav>
      {owner ? (
        <EditableJournal
          key={`${photos.length}-${page.layoutJson.length}`}
          pageId={id}
          initialLayout={layout}
          photos={photos}
          initialEntryDate={page.entryDate.toISOString()}
        />
      ) : (
        <MagazinePageWithFooter
          layout={layout}
          photos={photos}
          createdAt={page.entryDate}
        />
      )}
    </div>
  );
}
