"use server";

import { redirect } from "next/navigation";
import sharp from "sharp";
import type {
  ContentBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";

import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { uploadImage } from "@/lib/storage";
import { isEditor } from "@/lib/owner";
import type { Layout } from "@/lib/layout";

const MODEL = "claude-sonnet-4-6";
const MAX_PHOTOS = 100;
const AI_MAX_EDGE = 1568;

const SUPPORTED_MIME = new Set<
  "image/jpeg" | "image/png" | "image/webp" | "image/gif"
>(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const SYSTEM_PROMPT = `You are an editorial designer laying out a personal photo-journal magazine page.

Design with intention: pace photos and text the way a print magazine would. Open strong with a hero, vary block sizes, group similar photos into galleries, and let occasional pull quotes break up text.

Refer to photos strictly by their 1-based index (the order they were shown to you).

Block types you may use:
- "hero": one feature photo + headline (+ optional subhead). Use exactly once, as the first block.
- "text": a paragraph of body copy in plain markdown (italics allowed via *asterisks*). Keep paragraphs tight — 2 to 5 sentences.
- "photo": a single photo with optional caption. "size" is "small" | "medium" | "full".
- "gallery": 2-9 related photos shown together with an optional shared caption. Prefer galleries over many sequential single-photo blocks — they read more like a magazine spread.
- "quote": a short pulled-quote drawn from or inspired by the user's summary.

Scale the layout to the photo count: roughly N/2 to N blocks for N photos, with a minimum of 5. Use every photo at least once across hero/photo/gallery (do not omit photos). With many photos (20+), lean on gallery blocks to group related shots.`;

const layoutTool = {
  name: "submit_layout",
  description: "Submit the final magazine page layout.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Magazine-style headline for the page.",
      },
      intro: {
        type: "string",
        description: "1-2 sentence dek / standfirst that runs under the title.",
      },
      blocks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["hero", "text", "photo", "gallery", "quote"],
            },
            photoIdx: { type: "integer", description: "1-based photo index." },
            photoIdxs: {
              type: "array",
              items: { type: "integer" },
              description: "1-based photo indices for gallery blocks.",
            },
            headline: { type: "string" },
            subhead: { type: "string" },
            markdown: { type: "string" },
            caption: { type: "string" },
            size: { type: "string", enum: ["small", "medium", "full"] },
            text: { type: "string" },
            attribution: { type: "string" },
          },
          required: ["type"],
        },
      },
    },
    required: ["title", "intro", "blocks"],
  },
};

export type CreatePageState = { error: string | null };

export async function createPage(
  _prev: CreatePageState,
  formData: FormData,
): Promise<CreatePageState> {
  if (!(await isEditor())) return { error: "Sign in first." };

  const summary = String(formData.get("summary") ?? "").trim();
  const entryDateRaw = String(formData.get("entryDate") ?? "").trim();
  const entryDate = entryDateRaw ? new Date(entryDateRaw) : new Date();
  if (Number.isNaN(entryDate.getTime())) {
    return { error: "Please enter a valid entry date." };
  }
  const files = formData
    .getAll("photos")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (!summary) return { error: "Please add a summary of what happened." };
  if (files.length === 0) return { error: "Please upload at least one photo." };
  if (files.length > MAX_PHOTOS)
    return { error: `Limit to ${MAX_PHOTOS} photos per page for now.` };

  for (const file of files) {
    if (!SUPPORTED_MIME.has(file.type as ImageMime)) {
      return { error: `Unsupported file type: ${file.type}` };
    }
  }

  let pageId: string;
  try {
    const saved: {
      filePath: string;
      aiBase64: string;
      width: number | null;
      height: number | null;
    }[] = [];
    for (const file of files) {
      const original = Buffer.from(await file.arrayBuffer());

      // EXIF-rotated original for upload (so dimensions and orientation match).
      const rotated = await sharp(original).rotate().toBuffer();

      // Downsample a copy for Claude: long edge ~1568px, JPEG q85.
      // Keeps total request well under the 32MB Anthropic limit even with many photos.
      const aiBuffer = await sharp(rotated)
        .resize({
          width: AI_MAX_EDGE,
          height: AI_MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      const upload = await uploadImage(rotated);

      saved.push({
        filePath: upload.publicId,
        aiBase64: aiBuffer.toString("base64"),
        width: upload.width,
        height: upload.height,
      });
    }

    const userContent: ContentBlockParam[] = [];
    saved.forEach((photo, i) => {
      userContent.push({ type: "text", text: `Photo ${i + 1}:` });
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: photo.aiBase64,
        },
      });
    });
    userContent.push({
      type: "text",
      text: `Summary of what happened (from the journaler):\n\n${summary}\n\nPlease design the layout now using submit_layout.`,
    });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [layoutTool],
      tool_choice: { type: "tool", name: "submit_layout" },
      messages: [{ role: "user", content: userContent }],
    });

    const toolUse = response.content.find(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) return { error: "Claude did not return a layout. Try again." };

    const layout = toolUse.input as Layout;

    const page = await prisma.page.create({
      data: {
        title: layout.title,
        summary,
        layoutJson: JSON.stringify(layout),
        entryDate,
        photos: {
          create: saved.map((s, i) => ({
            filePath: s.filePath,
            width: s.width,
            height: s.height,
            order: i,
          })),
        },
      },
    });
    pageId = page.id;
  } catch (e) {
    console.error("createPage failed:", e);
    return {
      error: e instanceof Error ? e.message : "Failed to generate the page.",
    };
  }

  // Outside the try/catch so the NEXT_REDIRECT signal isn't swallowed.
  redirect(`/journal/${pageId}`);
}
