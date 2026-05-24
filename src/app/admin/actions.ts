"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOwner, getCurrentUserEmail } from "@/lib/owner";

export type AddEditorState = { error: string | null };

export async function addEditor(
  _prev: AddEditorState,
  formData: FormData,
): Promise<AddEditorState> {
  await requireOwner();
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!raw) return { error: "Enter an email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { error: "Not a valid email address." };
  }
  if (raw === process.env.OWNER_EMAIL?.toLowerCase()) {
    return { error: "That's already the owner." };
  }

  const addedBy = (await getCurrentUserEmail()) ?? "owner";

  try {
    await prisma.editor.create({
      data: { email: raw, addedBy },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add.";
    if (msg.includes("Unique") || msg.includes("duplicate")) {
      return { error: "Already an editor." };
    }
    return { error: msg };
  }
  revalidatePath("/admin");
  return { error: null };
}

export async function removeEditor(email: string) {
  await requireOwner();
  await prisma.editor.delete({ where: { email: email.toLowerCase() } });
  revalidatePath("/admin");
}
