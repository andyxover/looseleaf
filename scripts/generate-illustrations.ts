// Fill in editorial illustrations for any Page that has no photos.
//
// For each photoless Page:
//   1. Send the title + summary to Claude — it returns a single image prompt.
//   2. Generate the image on OpenAI's gpt-image-1.
//   3. Upload to Cloudinary.
//   4. Insert a Photo row + prepend a "photo" block to the layout so the
//      illustration sits between the masthead and the body text.
//
// Usage:
//   npx tsx scripts/generate-illustrations.ts
//
// Cost: gpt-image-1 (medium quality, 1024x1024) ≈ $0.04 per image.

import OpenAI from "openai";

import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { uploadImage } from "@/lib/storage";
import type { Layout, Block } from "@/lib/layout";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";

// Stable style suffix appended to every prompt so the illustrations feel
// like they were made by the same designer.
const STYLE = [
  "Flat editorial illustration in the style of a contemporary magazine cover.",
  "Muted warm color palette with one or two accent colors.",
  "Generous negative space, gentle paper-grain texture, subtly geometric.",
  "Stylised and graphic — not a photo.",
  "No text, no letters, no captions.",
].join(" ");

const PROMPT_SYSTEM = `You write single, focused image prompts for an editorial illustration model.

Given a school journal entry (a weekly announcement or short writeup), write ONE concise scene description — about 20-40 words — that captures the entry visually. Think New Yorker cover or Quanta Magazine: one strong concept, no clutter.

Do NOT include style language like "watercolor" or "illustration"; the style is applied automatically. Focus only on the SCENE: what is happening, who is in it, where.

Respond with the scene description only — no labels, no quotes, no explanation.`;

async function promptForEntry(title: string, summary: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    system: PROMPT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Title: ${title}\n\nSummary:\n${summary}\n\nWrite the image prompt.`,
      },
    ],
  });
  return response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function generateImage(
  openai: OpenAI,
  scenePrompt: string,
): Promise<Buffer> {
  const prompt = `${scenePrompt}\n\n${STYLE}`;
  const result = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: "1536x1024", // 3:2 landscape — sits well in a photo-block "full" layout
    quality: "medium",
    n: 1,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");
  return Buffer.from(b64, "base64");
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Set OPENAI_API_KEY in .env.local first.");
    process.exit(1);
  }
  const openai = new OpenAI();

  const pages = await prisma.page.findMany({
    where: { photos: { none: {} } },
    orderBy: { entryDate: "asc" },
  });
  console.log(`Found ${pages.length} photoless pages.\n`);

  let done = 0;
  let i = 0;
  for (const page of pages) {
    i++;
    console.log(`[${i}/${pages.length}] ${page.title}`);

    try {
      const scenePrompt = await promptForEntry(page.title, page.summary);
      console.log(`   ✎ prompt: ${scenePrompt}`);

      const imageBuffer = await generateImage(openai, scenePrompt);
      console.log(`   🎨 generated (${(imageBuffer.length / 1024).toFixed(0)} KB)`);

      const upload = await uploadImage(imageBuffer);
      console.log(`   ⬆ uploaded: ${upload.publicId}`);

      await prisma.photo.create({
        data: {
          pageId: page.id,
          filePath: upload.publicId,
          width: upload.width,
          height: upload.height,
          order: 0,
        },
      });

      // Prepend a photo block (size: full) so the illustration leads the body.
      const layout = JSON.parse(page.layoutJson) as Layout;
      const newBlock: Block = {
        type: "photo",
        photoIdx: 1,
        size: "full",
        caption: "",
      };
      layout.blocks.unshift(newBlock);
      await prisma.page.update({
        where: { id: page.id },
        data: { layoutJson: JSON.stringify(layout) },
      });

      done++;
      console.log(`   ✅ done\n`);
    } catch (e) {
      console.error(`   ❌ ${e instanceof Error ? e.message : e}\n`);
    }
  }

  console.log(`✨ Done. Illustrated ${done}/${pages.length} pages.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
