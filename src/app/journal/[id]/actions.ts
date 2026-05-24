"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { uploadImage } from "@/lib/storage";
import { requireEditor, isEditor } from "@/lib/owner";
import type { Block, Layout } from "@/lib/layout";

const SUPPORTED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function updatePageLayout(id: string, layout: Layout) {
  await requireEditor();
  if (!layout || typeof layout !== "object") throw new Error("Invalid layout");
  if (typeof layout.title !== "string") throw new Error("Invalid title");
  if (!Array.isArray(layout.blocks)) throw new Error("Invalid blocks");

  await prisma.page.update({
    where: { id },
    data: {
      title: layout.title,
      layoutJson: JSON.stringify(layout),
    },
  });
  revalidatePath(`/journal/${id}`);
  revalidatePath("/");
}

export async function deletePage(id: string) {
  await requireEditor();
  await prisma.page.delete({ where: { id } });
  redirect("/");
}

export type AddPhotosState = { error: string | null };

export async function addPhotosToPage(
  pageId: string,
  _prev: AddPhotosState,
  formData: FormData,
): Promise<AddPhotosState> {
  if (!(await isEditor())) return { error: "Sign in first." };

  const files = formData
    .getAll("photos")
    .filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) return { error: "No photos selected." };
  if (files.length > 50)
    return { error: "Add up to 50 photos at a time." };

  for (const file of files) {
    if (!SUPPORTED_MIME.has(file.type)) {
      return { error: `Unsupported file type: ${file.type}` };
    }
  }

  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) return { error: "Entry not found." };

  const lastPhoto = await prisma.photo.findFirst({
    where: { pageId },
    orderBy: { order: "desc" },
  });
  let nextOrder = (lastPhoto?.order ?? -1) + 1;

  const layout = JSON.parse(page.layoutJson) as Layout;
  const newBlocks: Block[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rotated = await sharp(buffer).rotate().toBuffer();
    const upload = await uploadImage(rotated);

    await prisma.photo.create({
      data: {
        pageId,
        filePath: upload.publicId,
        width: upload.width,
        height: upload.height,
        order: nextOrder,
      },
    });

    newBlocks.push({
      type: "photo",
      photoIdx: nextOrder + 1, // 1-based
      size: "medium",
      caption: "",
    });
    nextOrder++;
  }

  layout.blocks.push(...newBlocks);
  await prisma.page.update({
    where: { id: pageId },
    data: { layoutJson: JSON.stringify(layout) },
  });

  revalidatePath(`/journal/${pageId}`);
  revalidatePath("/");
  return { error: null };
}
