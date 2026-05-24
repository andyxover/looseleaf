// Bulk-import event folders → Looseleaf entries.
//
// Folder layout (each subfolder of the parent):
//   YYYY-MM-DD <event-name>/
//     _announcement-text.txt   (optional notes — passed to Claude as the summary)
//     *.jpg | *.png | ...      (any number of photos, including zero)
//
// For each folder we:
//   1. Parse the leading date — sets Page.entryDate.
//   2. Read the announcement text (if present).
//   3. Upload each image to Cloudinary at full quality.
//   4. Send a 1568-px-edge JPEG copy to Claude with the announcement text,
//      asking it to design a magazine layout.
//   5. Write the Page + Photo records to Postgres.
//
// Idempotent: skips any entry whose entryDate already has a page with a
// matching slug (so a half-completed batch can be re-run safely).
//
// Usage:
//   npx tsx scripts/bulk-import.ts "/path/to/parent/folder"

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

const MODEL = "claude-sonnet-4-6";
const AI_MAX_EDGE = 1568;
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const SYSTEM_PROMPT = `You are an editorial designer laying out a personal photo-journal magazine page.

Design with intention: pace photos and text the way a print magazine would. Open strong with a hero, vary block sizes, group similar photos into galleries, and let occasional pull quotes break up text.

Refer to photos strictly by their 1-based index (the order they were shown to you).

Block types you may use:
- "hero": one feature photo + headline (+ optional subhead). Use exactly once, as the first block. ONLY if photos are provided.
- "text": a paragraph of body copy in plain markdown (italics allowed via *asterisks*). Keep paragraphs tight — 2 to 5 sentences.
- "photo": a single photo with optional caption. "size" is "small" | "medium" | "full".
- "gallery": 2-9 related photos shown together with an optional shared caption. Prefer galleries over many sequential single-photo blocks — they read more like a magazine spread.
- "quote": a short pulled-quote drawn from or inspired by the user's summary.

If photos are provided, scale the layout to the photo count: roughly N/2 to N blocks for N photos, with a minimum of 5. Use every photo at least once across hero/photo/gallery (do not omit photos). With many photos (20+), lean on gallery blocks.

If NO photos are provided, design a text-only entry: open with a short "text" block as the opener, follow with body text broken into a few paragraphs, and use 1-2 "quote" blocks if the source has memorable lines. Do NOT use hero/photo/gallery blocks when there are no photos.

Generate a fitting magazine-style title — do not echo the literal folder name back as the title.`;

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

function parseFolder(name: string): { date: Date; titleHint: string } | null {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/);
  if (!m) return null;
  // Noon UTC anchor — keeps the calendar day stable regardless of viewer TZ.
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`);
  return { date, titleHint: m[4].trim() };
}

async function listImages(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  return entries
    .filter(
      (e) =>
        e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()),
    )
    .map((e) => path.join(folder, e.name))
    .sort();
}

async function readAnnouncement(folder: string): Promise<string> {
  try {
    const txt = await readFile(
      path.join(folder, "_announcement-text.txt"),
      "utf-8",
    );
    return txt.trim();
  } catch {
    return "";
  }
}

async function importFolder(folderPath: string): Promise<"imported" | "skipped" | "error"> {
  const folderName = path.basename(folderPath);
  const parsed = parseFolder(folderName);
  if (!parsed) {
    console.log(`⏭  skip (no date prefix): ${folderName}`);
    return "skipped";
  }
  const { date, titleHint } = parsed;

  // Idempotency: same entryDate + a page whose summary mentions the folder
  // hint is treated as a duplicate.
  const existing = await prisma.page.findFirst({
    where: {
      entryDate: date,
      summary: { contains: titleHint.slice(0, 24) },
    },
  });
  if (existing) {
    console.log(
      `⏭  skip (already imported as "${existing.title}"): ${folderName}`,
    );
    return "skipped";
  }

  const photoPaths = await listImages(folderPath);
  const announcement = await readAnnouncement(folderPath);

  console.log(
    `📄 ${folderName} — ${photoPaths.length} photos${announcement ? ", with text" : ""}`,
  );

  // Upload photos + prep downsampled copy for Claude
  const saved: {
    filePath: string;
    aiBase64: string;
    width: number | null;
    height: number | null;
  }[] = [];
  for (const pPath of photoPaths) {
    try {
      const buf = await readFile(pPath);
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
        filePath: upload.publicId,
        aiBase64: aiBuf.toString("base64"),
        width: upload.width,
        height: upload.height,
      });
    } catch (e) {
      console.warn(
        `   ⚠  failed photo ${path.basename(pPath)}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  // Build Claude message
  const userContent: ContentBlockParam[] = [];
  saved.forEach((p, i) => {
    userContent.push({ type: "text", text: `Photo ${i + 1}:` });
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: p.aiBase64,
      },
    });
  });

  let prompt = `Source folder: ${folderName}\n`;
  prompt += `Event date: ${date.toISOString().slice(0, 10)}\n\n`;
  if (announcement) {
    prompt += `Original notes / announcement text:\n\n${announcement}\n\n`;
  }
  if (saved.length > 0) {
    prompt += `${saved.length} photos provided above. Use every photo at least once.`;
  } else {
    prompt += `No photos. Design a text-only entry using only text and quote blocks.`;
  }
  userContent.push({ type: "text", text: prompt });

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
  if (!toolUse) {
    console.warn(`   ⚠  Claude returned no layout`);
    return "error";
  }
  const layout = toolUse.input as Layout;

  const page = await prisma.page.create({
    data: {
      title: layout.title,
      // Stash the folder-hint and announcement together in `summary` so the
      // dedup query can find it later AND so the editor still has the source.
      summary: `[${titleHint}] ${announcement || ""}`.trim(),
      layoutJson: JSON.stringify(layout),
      entryDate: date,
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

  console.log(`   ✅ "${page.title}" — ${saved.length} photos`);
  return "imported";
}

async function main() {
  const parent = process.argv[2];
  if (!parent) {
    console.error("Usage: npx tsx scripts/bulk-import.ts <parent-folder>");
    process.exit(1);
  }
  const absParent = path.resolve(parent);
  const entries = await readdir(absParent, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(absParent, e.name))
    .sort();

  console.log(`Found ${folders.length} folders in ${absParent}\n`);

  const counts = { imported: 0, skipped: 0, error: 0 };
  for (let i = 0; i < folders.length; i++) {
    process.stdout.write(`[${i + 1}/${folders.length}] `);
    try {
      const result = await importFolder(folders[i]);
      counts[result]++;
    } catch (e) {
      counts.error++;
      console.error(
        `   ❌ error: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  console.log(
    `\n✨ Done. imported=${counts.imported} skipped=${counts.skipped} errors=${counts.error}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
