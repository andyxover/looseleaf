// Pre-translate every entry into English + Traditional Chinese, storing the
// results in Page.layoutEn / Page.layoutZh. Structure-preserving (see
// src/lib/translate.ts). Idempotent: skips entries that already have both.
//
// Usage:
//   npx tsx scripts/translate-entries.ts

import { prisma } from "@/lib/prisma";
import { translateLayout } from "@/lib/translate";
import type { Layout } from "@/lib/layout";

async function main() {
  const pages = await prisma.page.findMany({
    where: {
      OR: [{ layoutEn: null }, { layoutZh: null }],
    },
    orderBy: { entryDate: "desc" },
    select: { id: true, title: true, layoutJson: true, layoutEn: true, layoutZh: true },
  });
  console.log(`${pages.length} entries need translation.\n`);

  let done = 0;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    process.stdout.write(`[${i + 1}/${pages.length}] ${p.title.slice(0, 56)}… `);
    let layout: Layout;
    try {
      layout = JSON.parse(p.layoutJson) as Layout;
    } catch {
      console.log("⏭  (bad layout)");
      continue;
    }

    try {
      const updates: { layoutEn?: string; layoutZh?: string } = {};
      if (!p.layoutEn) {
        const en = await translateLayout(layout, "en");
        updates.layoutEn = JSON.stringify(en);
      }
      if (!p.layoutZh) {
        const zh = await translateLayout(layout, "zh");
        updates.layoutZh = JSON.stringify(zh);
      }
      await prisma.page.update({ where: { id: p.id }, data: updates });
      done++;
      console.log("✅");
    } catch (e) {
      console.log(`❌ ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n✨ Done. Translated ${done}/${pages.length}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
