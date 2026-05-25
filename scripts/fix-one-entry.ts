// One-off: import the single post whose auto-illustration prompt kept tripping
// OpenAI's safety filter (it referenced real NBA players). We supply a
// name-free illustration prompt by hand, then run the normal layout step.

import { readFile } from "node:fs/promises";
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

const FOLDER =
  "/Users/andyxover/Documents/Claude/Projects/TCS Teams Announcement Organizer/TCS Facebook Page Archive/Facebook Posts/2025/2025-03-09 🎙️【#ProjectBasedLearning TCS G8 Students Show";

const MODEL = "claude-sonnet-4-6";
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";

// Hand-written, name-free scene (the auto prompt named real athletes → blocked).
const SCENE =
  "Two middle-school students recording a podcast in a cozy school studio, leaning into microphones with headphones on, a basketball resting on the desk beside their notes, warm afternoon light through the window.";
const STYLE = [
  "Flat editorial illustration in the style of a contemporary magazine cover.",
  "Muted warm color palette with one or two accent colors.",
  "Generous negative space, gentle paper-grain texture, subtly geometric.",
  "Stylised and graphic — not a photo. No text, no letters.",
].join(" ");

const SYSTEM_PROMPT = `You are an editorial designer laying out a magazine page from a Facebook post. You have ONE auto-generated illustration — use it as the hero block, then text + 1-2 quote blocks. Match the source language (this post is bilingual Chinese/English — a bilingual layout is fine). Generate a fitting magazine-style title.`;

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

async function main() {
  const postTxt = (await readFile(path.join(FOLDER, "post.txt"), "utf-8")).trim();
  const date = new Date("2025-03-09T12:00:00.000Z");

  // Skip if it somehow already exists.
  const existing = await prisma.page.findFirst({
    where: { entryDate: date, summary: { contains: "ProjectBasedLearning" } },
  });
  if (existing) {
    console.log("Already exists:", existing.title);
    await prisma.$disconnect();
    return;
  }

  const openai = new OpenAI();
  console.log("Generating illustration (name-free prompt)…");
  const imageResp = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: `${SCENE}\n\n${STYLE}`,
    size: "1536x1024",
    quality: "medium",
    n: 1,
  });
  const b64 = imageResp.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data");
  const illustration = Buffer.from(b64, "base64");
  const aiBuffer = await sharp(illustration)
    .resize({ width: 1568, height: 1568, fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();
  const upload = await uploadImage(illustration);
  console.log("Uploaded:", upload.publicId);

  const userContent: ContentBlockParam[] = [
    { type: "text", text: "Photo 1:" },
    {
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: aiBuffer.toString("base64") },
    },
    {
      type: "text",
      text: `Original Facebook post:\n\n${postTxt}\n\nOne auto-illustration above — use as hero, then text + 1-2 quotes.`,
    },
  ];

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
  if (!toolUse) throw new Error("No layout");
  const layout = toolUse.input as Layout;

  await prisma.page.create({
    data: {
      title: layout.title,
      summary: `[ProjectBasedLearning TCS G8 Students Show] ${postTxt}`,
      layoutJson: JSON.stringify(layout),
      entryDate: date,
      photos: {
        create: [
          {
            filePath: upload.publicId,
            width: upload.width,
            height: upload.height,
            order: 0,
          },
        ],
      },
    },
  });
  console.log(`✅ Created: "${layout.title}"`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
