// Bulk-import the TCS Facebook page archive into Looseleaf.
//
// Folder layout:
//   <parent>/
//     2023/
//       YYYY-MM-DD <preview>/
//         post.txt              (Date: YYYY-MM-DD HH:MM\n<header>\n\n<body>)
//         *.jpg | *.png         (zero or more photos)
//       …
//     2024/, 2025/, 2026/
//
// For each post folder we:
//   1. Skip "link share" folders (FB link reposts, no original content).
//   2. Parse post.txt: extract date + body.
//   3. Upload each photo to Cloudinary (server-side, with sharp downsample
//      for the AI request).
//   4. Ask Claude (Sonnet 4.6) to design the magazine layout, matching the
//      source post's language.
//   5. If the folder has zero photos, generate ONE editorial illustration
//      via gpt-image-2 and use it as the hero.
//   6. Write Page + Photo rows to Postgres.
//
// Idempotent — already-imported posts (same entryDate + summary head) are
// skipped, so re-running picks up failures only.
//
// Usage:
//   npx tsx scripts/bulk-import-facebook.ts "/path/to/Facebook Posts"

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import OpenAI from "openai";
import type {
  ContentBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";

import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { uploadImage } from "@/lib/storage";
import type { Layout } from "@/lib/layout";

const MODEL = "claude-sonnet-4-6";
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";
const AI_MAX_EDGE = 1568;
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const ILLUSTRATION_STYLE = [
  "Flat editorial illustration in the style of a contemporary magazine cover.",
  "Muted warm color palette with one or two accent colors.",
  "Generous negative space, gentle paper-grain texture, subtly geometric.",
  "Stylised and graphic — not a photo.",
  "No text, no letters, no captions.",
].join(" ");

const ILLUSTRATION_PROMPT_SYSTEM = `You write single, focused image prompts for an editorial illustration model.

Given the summary of a journal entry, write ONE concise scene description — about 20-40 words — that captures the entry visually. Think New Yorker cover or Quanta Magazine: one strong concept, no clutter.

Do NOT include style language like "watercolor" or "illustration"; the style is applied automatically. Focus only on the SCENE: what is happening, who is in it, where.

Respond with the scene description only — no labels, no quotes, no explanation.`;

const SYSTEM_PROMPT = `You are an editorial designer laying out a personal photo-journal magazine page from a Facebook post.

Pace photos and text the way a print magazine would: open with a hero, vary block sizes, group related photos into galleries, occasional pull quotes. Refer to photos by 1-based index.

Block types:
- "hero": one feature photo + headline (+ optional subhead). Use exactly once, first block. ONLY if photos are provided.
- "text": markdown paragraph (italic via *asterisks*). Keep paragraphs tight, 2-5 sentences.
- "photo": one photo with optional caption. "size" is "small" | "medium" | "full".
- "gallery": 2-9 related photos shown together with optional shared caption. Prefer galleries over runs of single-photo blocks.
- "quote": short pull-quote drawn from or inspired by the source text.

If photos are provided, scale the layout to the photo count: roughly N/2 to N blocks for N photos, min 5. Use every photo at least once. With 20+ photos, lean on gallery blocks.

If you are shown exactly ONE photo, it's an auto-generated editorial illustration — use it as the hero. The rest of the layout should be text + 1-2 quote blocks. No additional photo/gallery blocks.

**Language**: match the source post.
- If the source is mainly in Traditional Chinese, generate a Traditional Chinese title, intro, headlines, and body.
- If mainly English, generate English throughout.
- If genuinely bilingual (both languages substantial), produce a bilingual layout — Chinese for some blocks, English for others, as fits the source's rhythm.
- Preserve TCS-specific names ("TCS", any English program names) verbatim.

Generate a fitting magazine-style title that captures the post's essence — do not just echo the folder name.`;

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

function parseFolder(name: string): { date: Date | null; titleHint: string } {
  // "YYYY-MM-DD <rest>"
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/);
  if (!m) return { date: null, titleHint: name };
  return {
    date: new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`),
    titleHint: m[4].trim(),
  };
}

function parseDateFromPostTxt(text: string): Date | null {
  const m = text.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}T12:00:00.000Z`);
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

async function readPostTxt(folder: string): Promise<string> {
  try {
    const t = await readFile(path.join(folder, "post.txt"), "utf-8");
    return t.trim();
  } catch {
    return "";
  }
}

async function uploadWithRetry(
  buffer: Buffer,
  attempts = 3,
): Promise<{ publicId: string; width: number; height: number }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await uploadImage(buffer);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Upload failed");
}

async function importFolder(
  folderPath: string,
  openai: OpenAI,
): Promise<"imported" | "skipped" | "error"> {
  const folderName = path.basename(folderPath);

  if (/link share/i.test(folderName)) {
    return "skipped";
  }

  const postTxt = await readPostTxt(folderPath);
  const photoPaths = await listImages(folderPath);

  // Prefer the date in post.txt header (more accurate timestamp); fall back
  // to the folder name's date prefix.
  const fromTxt = parseDateFromPostTxt(postTxt);
  const fromFolder = parseFolder(folderName);
  const date = fromTxt ?? fromFolder.date;
  if (!date) {
    console.log(`⏭  skip (no date): ${folderName}`);
    return "skipped";
  }
  const titleHint = fromFolder.titleHint;

  // Idempotency: same entryDate + summary starts with the folder hint.
  const existing = await prisma.page.findFirst({
    where: {
      entryDate: date,
      summary: { contains: titleHint.slice(0, 24) },
    },
  });
  if (existing) {
    console.log(`⏭  skip (already imported): ${folderName.slice(0, 70)}…`);
    return "skipped";
  }

  console.log(
    `📄 ${folderName.slice(0, 80)}  —  ${photoPaths.length} photos${postTxt ? ", text" : ""}`,
  );

  type Saved = {
    publicId: string;
    width: number;
    height: number;
    aiBase64: string;
  };
  const saved: Saved[] = [];

  if (photoPaths.length === 0) {
    // Text-only — auto-illustrate via gpt-image-2.
    if (!process.env.OPENAI_API_KEY) {
      console.log(`   ⚠  text-only but no OPENAI_API_KEY — skipping`);
      return "skipped";
    }
    const promptResp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: ILLUSTRATION_PROMPT_SYSTEM,
      messages: [
        { role: "user", content: `Summary:\n${postTxt || titleHint}` },
      ],
    });
    const scenePrompt = promptResp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    const imageResp = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: `${scenePrompt}\n\n${ILLUSTRATION_STYLE}`,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });
    const b64 = imageResp.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image model returned no data");
    const illustration = Buffer.from(b64, "base64");
    const aiBuffer = await sharp(illustration)
      .resize({ width: AI_MAX_EDGE, height: AI_MAX_EDGE, fit: "inside" })
      .jpeg({ quality: 85 })
      .toBuffer();
    const upload = await uploadWithRetry(illustration);
    saved.push({
      publicId: upload.publicId,
      width: upload.width,
      height: upload.height,
      aiBase64: aiBuffer.toString("base64"),
    });
    console.log(`   🎨 generated illustration`);
  } else {
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
        const upload = await uploadWithRetry(rotated);
        saved.push({
          publicId: upload.publicId,
          width: upload.width,
          height: upload.height,
          aiBase64: aiBuf.toString("base64"),
        });
      } catch (e) {
        console.warn(
          `   ⚠  photo failed: ${path.basename(pPath)} — ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    if (saved.length === 0) {
      console.log(`   ⚠  all photos failed — skipping`);
      return "error";
    }
  }

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
  userContent.push({
    type: "text",
    text: `Source folder: ${folderName}\nEvent date: ${date.toISOString().slice(0, 10)}\n\nOriginal Facebook post:\n\n${postTxt}\n\n${
      saved.length === 1 && photoPaths.length === 0
        ? "No original photos — one auto-illustration above. Use it as hero, then text + 1-2 quote blocks."
        : `${saved.length} photos above. Use every photo at least once.`
    }`,
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
  if (!toolUse) {
    console.log(`   ❌ Claude returned no layout`);
    return "error";
  }
  const layout = toolUse.input as Layout;

  await prisma.page.create({
    data: {
      title: layout.title,
      summary: `[${titleHint}] ${postTxt || ""}`.trim(),
      layoutJson: JSON.stringify(layout),
      entryDate: date,
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

  console.log(`   ✅ "${layout.title.slice(0, 80)}"`);
  return "imported";
}

async function main() {
  const parent = process.argv[2];
  if (!parent) {
    console.error("Usage: npx tsx scripts/bulk-import-facebook.ts <parent-folder>");
    process.exit(1);
  }
  const openai = new OpenAI();

  const years = await readdir(parent, { withFileTypes: true });
  const folders: string[] = [];
  for (const y of years) {
    if (!y.isDirectory() || !/^\d{4}$/.test(y.name)) continue;
    const yearDir = path.join(parent, y.name);
    const subs = await readdir(yearDir, { withFileTypes: true });
    for (const s of subs) {
      if (s.isDirectory()) folders.push(path.join(yearDir, s.name));
    }
  }
  folders.sort();
  console.log(`Found ${folders.length} folders across ${years.length} years.\n`);

  const counts = { imported: 0, skipped: 0, error: 0 };
  for (let i = 0; i < folders.length; i++) {
    process.stdout.write(`[${i + 1}/${folders.length}] `);
    try {
      const result = await importFolder(folders[i], openai);
      counts[result]++;
    } catch (e) {
      counts.error++;
      console.error(`   ❌ ${e instanceof Error ? e.message : e}`);
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
