"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { isOwner } from "@/lib/owner";

const VISITOR_COOKIE = "lv_visitor";
const TWO_YEARS = 60 * 60 * 24 * 365 * 2;

export type CommentDTO = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
};

// A stable per-browser id used to dedup likes for anonymous visitors. Set on
// first write so casual readers can like without signing in.
async function getOrSetVisitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(VISITOR_COOKIE, id, {
    path: "/",
    maxAge: TWO_YEARS,
    sameSite: "lax",
  });
  return id;
}

// Raw view counter — incremented once per page mount from the client, skipping
// editors so the owner doesn't inflate their own numbers.
export async function recordView(pageId: string): Promise<void> {
  try {
    await prisma.page.update({
      where: { id: pageId },
      data: { views: { increment: 1 } },
    });
  } catch {
    // entry may have been deleted; ignore
  }
}

export async function toggleLike(
  pageId: string,
): Promise<{ liked: boolean; count: number }> {
  const visitorId = await getOrSetVisitorId();
  const existing = await prisma.like.findUnique({
    where: { pageId_visitorId: { pageId, visitorId } },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { pageId, visitorId } });
  }
  const count = await prisma.like.count({ where: { pageId } });
  return { liked: !existing, count };
}

export async function addComment(
  pageId: string,
  name: string,
  body: string,
): Promise<{ comment: CommentDTO } | { error: string }> {
  const authorName = name.trim().slice(0, 60) || "Anonymous";
  const text = body.trim().slice(0, 4000);
  if (!text) return { error: "Write something first." };
  const c = await prisma.comment.create({
    data: { pageId, authorName, body: text },
  });
  return {
    comment: {
      id: c.id,
      authorName: c.authorName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      editedAt: null,
    },
  };
}

// Owner-only moderation.
export async function editComment(
  id: string,
  body: string,
): Promise<{ ok: true; editedAt: string } | { error: string }> {
  if (!(await isOwner())) return { error: "Not allowed." };
  const text = body.trim().slice(0, 4000);
  if (!text) return { error: "Comment can't be empty." };
  const c = await prisma.comment.update({
    where: { id },
    data: { body: text, editedAt: new Date() },
  });
  return { ok: true, editedAt: c.editedAt!.toISOString() };
}

export async function deleteComment(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  if (!(await isOwner())) return { error: "Not allowed." };
  await prisma.comment.delete({ where: { id } });
  return { ok: true };
}
