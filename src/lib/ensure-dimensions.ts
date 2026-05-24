import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";

type WithDimensions<T extends { width: number | null; height: number | null }> = T & {
  width: number | null;
  height: number | null;
};

export async function ensureDimensions<
  T extends { id: string; filePath: string; width: number | null; height: number | null },
>(photos: T[]): Promise<WithDimensions<T>[]> {
  const missing = photos.filter((p) => !p.width || !p.height);
  if (missing.length === 0) return photos;

  await Promise.all(
    missing.map(async (p) => {
      try {
        const fullPath = path.join(process.cwd(), "public", p.filePath);
        const buffer = await readFile(fullPath);
        const meta = await sharp(buffer).rotate().metadata();
        if (meta.width && meta.height) {
          await prisma.photo.update({
            where: { id: p.id },
            data: { width: meta.width, height: meta.height },
          });
          p.width = meta.width;
          p.height = meta.height;
        }
      } catch (e) {
        console.warn(`ensureDimensions: failed for ${p.filePath}`, e);
      }
    }),
  );
  return photos;
}
