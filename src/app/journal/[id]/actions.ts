"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireEditor, isEditor } from "@/lib/owner";
import type { Block, Layout } from "@/lib/layout";

type IncomingPhoto = { publicId: string; width: number; height: number };

export async function updatePageLayout(
  id: string,
  layout: Layout,
  entryDate?: string,
) {
  await requireEditor();
  if (!layout || typeof layout !== "object") throw new Error("Invalid layout");
  if (typeof layout.title !== "string") throw new Error("Invalid title");
  if (!Array.isArray(layout.blocks)) throw new Error("Invalid blocks");

  // Accept either a "YYYY-MM-DD" date-only string (from the editor's date input)
  // or a full ISO. Anchor date-only values at noon UTC to dodge TZ shifts.
  let parsedEntryDate: Date | null = null;
  if (entryDate) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(entryDate)
      ? `${entryDate}T12:00:00.000Z`
      : entryDate;
    parsedEntryDate = new Date(iso);
    if (Number.isNaN(parsedEntryDate.getTime())) {
      throw new Error("Invalid entry date");
    }
  }

  await prisma.page.update({
    where: { id },
    data: {
      title: layout.title,
      layoutJson: JSON.stringify(layout),
      ...(parsedEntryDate ? { entryDate: parsedEntryDate } : {}),
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

  // Browser uploads directly to Cloudinary; we get back small JSON refs.
  const rawRefs = formData.getAll("photos");
  const photoRefs: IncomingPhoto[] = [];
  for (const raw of rawRefs) {
    if (typeof raw !== "string") continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.publicId === "string") {
        photoRefs.push({
          publicId: parsed.publicId,
          width: Number(parsed.width) || 0,
          height: Number(parsed.height) || 0,
        });
      }
    } catch {
      /* skip */
    }
  }

  if (photoRefs.length === 0) return { error: "No photos selected." };
  if (photoRefs.length > 50)
    return { error: "Add up to 50 photos at a time." };

  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) return { error: "Entry not found." };

  const lastPhoto = await prisma.photo.findFirst({
    where: { pageId },
    orderBy: { order: "desc" },
  });
  let nextOrder = (lastPhoto?.order ?? -1) + 1;

  const layout = JSON.parse(page.layoutJson) as Layout;
  const newBlocks: Block[] = [];

  for (const ref of photoRefs) {
    await prisma.photo.create({
      data: {
        pageId,
        filePath: ref.publicId,
        width: ref.width || null,
        height: ref.height || null,
        order: nextOrder,
      },
    });
    newBlocks.push({
      type: "photo",
      photoIdx: nextOrder + 1,
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
