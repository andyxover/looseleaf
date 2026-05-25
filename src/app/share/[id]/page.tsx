import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { MagazinePage } from "@/components/MagazinePage";
import { ensureDimensions } from "@/lib/ensure-dimensions";
import type { Layout } from "@/lib/layout";

// Photo-pipeline routes get a long timeout because the layout work can be heavy.
export const maxDuration = 60;

export default async function SharePage({
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

  // No nav, no editor toolbar, no footer with "Back to all entries". Just the
  // masthead + body. Recipient can read, but has no link to the rest of the site.
  return (
    <div className="min-h-screen pt-12 sm:pt-16">
      <MagazinePage
        layout={layout}
        photos={photos}
        createdAt={page.entryDate}
      />
      <div className="pb-20 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-400">
        ✦ Shared from Looseleaf ✦
      </div>
    </div>
  );
}
