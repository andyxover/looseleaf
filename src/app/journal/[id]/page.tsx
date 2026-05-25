import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { EditableJournal } from "@/components/EditableJournal";
import { MagazinePageWithFooter } from "@/components/MagazinePage";
import { LangToggle } from "@/components/LangToggle";
import { ensureDimensions } from "@/lib/ensure-dimensions";
import { isEditor } from "@/lib/owner";
import { getLang, resolveLayoutJson } from "@/lib/lang";
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

  const [owner, lang] = await Promise.all([isEditor(), getLang()]);
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
      {owner ? (
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
    </div>
  );
}
