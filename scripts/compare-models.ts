// Bake-off: pick one Facebook post folder, generate two Looseleaf entries
// from it — one with Haiku 4.5, one with Sonnet 4.6 — so the quality
// difference can be compared side-by-side on the home page.
//
// Photos are uploaded to Cloudinary once; each Page gets its own Photo rows
// pointing at the same public_ids (avoids paying for two uploads).
//
// Usage:
//   npx tsx scripts/compare-models.ts

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type {
  ContentBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";

import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { uploadImage } from "@/lib/storage";
import type { Layout } from "@/lib/layout";

// Hardcoded test folder — pick a photo-rich one with mixed content.
const TEST_FOLDER =
  "/Users/andyxover/Documents/Claude/Projects/TCS Teams Announcement Organizer/TCS Facebook Page Archive/Facebook Posts/2025/2025-04-01 【🔬TCS Experiential Learning Friday Experiment";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
];

const AI_MAX_EDGE = 1568;
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const SYSTEM_PROMPT = `You are an editorial designer laying out a personal photo-journal magazine page.

Pace photos and text the way a print magazine would: open with a hero, vary block sizes, group related photos into galleries, occasional pull quotes. Refer to photos by 1-based index.

Block types:
- "hero": one feature photo + headline (+ optional subhead). Use exactly once, first block.
- "text": markdown paragraph (italic via *asterisks*). Keep paragraphs tight, 2-5 sentences.
- "photo": one photo with optional caption. "size" is "small" | "medium" | "full".
- "gallery": 2-9 related photos shared together with optional shared caption. Prefer galleries to runs of single-photo blocks.
- "quote": short pull-quote drawn from the source.

5-10+ blocks. Use every photo at least once. Match the source's language: if the post is mainly Chinese, generate a Chinese title + body; mainly English → English; mixed → bilingual is fine.`;

const layoutTool = {
  name: "submit_layout",
  description: "Submit the final magazine page layout.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" },
      intro: { type: "string" },
      blocks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["hero", "text", "photo", "gallery", "quote"] },
            photoIdx: { type: "integer" },
            photoIdxs: { type: "array", items: { type: "integer" } },
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

function parseDateFromPostTxt(text: string): Date {
  const m = text.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return new Date();
  return new Date(`${m[1]}T12:00:00.000Z`);
}

async function main() {
  console.log(`📁 ${path.basename(TEST_FOLDER)}\n`);

  const entries = await readdir(TEST_FOLDER, { withFileTypes: true });
  const imagePaths = entries
    .filter(
      (e) =>
        e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()),
    )
    .map((e) => path.join(TEST_FOLDER, e.name))
    .sort();

  const postTxt = await readFile(
    path.join(TEST_FOLDER, "post.txt"),
    "utf-8",
  );
  const entryDate = parseDateFromPostTxt(postTxt);
  console.log(`📅 ${entryDate.toISOString().slice(0, 10)}`);
  console.log(`📸 ${imagePaths.length} photos\n`);

  // Upload once, reuse for both pages.
  type Saved = {
    publicId: string;
    width: number;
    height: number;
    aiBase64: string;
  };
  const saved: Saved[] = [];
  console.log("Uploading photos to Cloudinary (once)…");
  for (let i = 0; i < imagePaths.length; i++) {
    const buf = await readFile(imagePaths[i]);
    const rotated = await sharp(buf).rotate().toBuffer();
    const aiBuf = await sharp(rotated)
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
      publicId: upload.publicId,
      width: upload.width,
      height: upload.height,
      aiBase64: aiBuf.toString("base64"),
    });
    process.stdout.write(`  ${i + 1}/${imagePaths.length}\r`);
  }
  console.log(`  ${imagePaths.length}/${imagePaths.length} ✅\n`);

  // Build the Claude message body once — same input for both models.
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
    text: `Source post (from TCS's Facebook page):\n\n${postTxt}\n\nDesign the magazine layout using submit_layout.`,
  });

  for (const model of MODELS) {
    console.log(`🧠 Generating with ${model.label} (${model.id})…`);
    const t0 = Date.now();
    const response = await anthropic.messages.create({
      model: model.id,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [layoutTool],
      tool_choice: { type: "tool", name: "submit_layout" },
      messages: [{ role: "user", content: userContent }],
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const toolUse = response.content.find(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) {
      console.log(`  ❌ no layout returned`);
      continue;
    }
    const layout = toolUse.input as Layout;
    // Prefix title with model label so they're distinguishable in the list.
    const prefixedTitle = `[${model.label}] ${layout.title}`;

    const usage = response.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined;

    const page = await prisma.page.create({
      data: {
        title: prefixedTitle,
        summary: `[bake-off ${model.label}] ${postTxt.slice(0, 300)}`,
        layoutJson: JSON.stringify({ ...layout, title: prefixedTitle }),
        entryDate,
        photos: {
          create: saved.map((s, i) => ({
            filePath: s.publicId,
            width: s.width,
            height: s.height,
            order: i,
          })),
        },
      },
    });
    console.log(
      `  ✅ ${elapsed}s · ${usage?.input_tokens ?? "?"} in / ${usage?.output_tokens ?? "?"} out · /journal/${page.id}\n`,
    );
  }

  await prisma.$disconnect();
  console.log("Done. Both entries now on the home page, prefixed with [Haiku] and [Sonnet].");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
