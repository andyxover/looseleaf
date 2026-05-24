// One-shot migration: copy data from local SQLite + Cloudinary-fy any
// local photo paths, then write everything into the Postgres database that
// DATABASE_URL currently points at.
//
// Usage:
//   1. Put the Supabase Postgres URLs in .env.local
//      DATABASE_URL=postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1
//      DIRECT_URL=postgresql://...:5432/postgres
//   2. Run the Postgres schema migration first (npx prisma migrate dev --name init)
//   3. Then: npx tsx scripts/migrate-to-cloud.ts
//
// Idempotent-ish: skips any page whose id already exists in Postgres.

import Database from "better-sqlite3";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { uploadImage } from "@/lib/storage";

type SqlPage = {
  id: string;
  title: string;
  summary: string;
  layoutJson: string;
  createdAt: number | string;
};

type SqlPhoto = {
  id: string;
  pageId: string;
  filePath: string;
  width: number | null;
  height: number | null;
  order: number;
};

async function main() {
  const sqlitePath = path.join(process.cwd(), "dev.db");
  console.log(`📖 Reading from ${sqlitePath}`);
  const db = new Database(sqlitePath, { readonly: true });

  const pages = db
    .prepare("SELECT * FROM Page ORDER BY createdAt ASC")
    .all() as SqlPage[];
  const photos = db
    .prepare('SELECT * FROM Photo ORDER BY pageId, "order"')
    .all() as SqlPhoto[];

  console.log(`   ${pages.length} pages, ${photos.length} photos\n`);

  const photosByPage = new Map<string, SqlPhoto[]>();
  for (const ph of photos) {
    const arr = photosByPage.get(ph.pageId) ?? [];
    arr.push(ph);
    photosByPage.set(ph.pageId, arr);
  }

  let pageIdx = 0;
  for (const p of pages) {
    pageIdx++;
    const exists = await prisma.page.findUnique({ where: { id: p.id } });
    if (exists) {
      console.log(`[${pageIdx}/${pages.length}] skip (already in Postgres): ${p.title}`);
      continue;
    }

    console.log(`[${pageIdx}/${pages.length}] migrate: ${p.title}`);
    const pagePhotos = photosByPage.get(p.id) ?? [];

    const newPhotos: SqlPhoto[] = [];
    for (const photo of pagePhotos) {
      if (photo.filePath.startsWith("/uploads/")) {
        // Local file — upload to Cloudinary
        const fullPath = path.join(process.cwd(), "public", photo.filePath);
        try {
          const buffer = await readFile(fullPath);
          const result = await uploadImage(buffer);
          console.log(`   ⬆  ${photo.filePath} → ${result.publicId}`);
          newPhotos.push({
            ...photo,
            filePath: result.publicId,
            width: result.width || photo.width,
            height: result.height || photo.height,
          });
        } catch (e) {
          console.warn(
            `   ⚠  Skipping ${photo.filePath} (read/upload failed): ${e instanceof Error ? e.message : e}`,
          );
        }
      } else {
        // Already a Cloudinary public_id
        newPhotos.push(photo);
      }
    }

    await prisma.page.create({
      data: {
        id: p.id,
        title: p.title,
        summary: p.summary,
        layoutJson: p.layoutJson,
        createdAt: new Date(p.createdAt),
        photos: {
          create: newPhotos.map((ph) => ({
            id: ph.id,
            filePath: ph.filePath,
            width: ph.width,
            height: ph.height,
            order: ph.order,
          })),
        },
      },
    });
    console.log(`   ✅ wrote with ${newPhotos.length} photos\n`);
  }

  console.log(`\n✨ Done. Migrated ${pages.length} pages.`);
  db.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
