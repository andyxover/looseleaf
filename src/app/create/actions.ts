"use server";

import { redirect } from "next/navigation";
import OpenAI from "openai";
import type {
  ContentBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";

import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { uploadImage } from "@/lib/storage";
import { isEditor } from "@/lib/owner";
import { translateLayout } from "@/lib/translate";
import type { Layout } from "@/lib/layout";
import { extractCloudinaryPublicIds, htmlToPlainText } from "@/lib/richtext";

const MODEL = "claude-sonnet-4-6";
const MAX_PHOTOS = 100;
const AI_MAX_EDGE = 1568;
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";

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

const SYSTEM_PROMPT = `You are an editorial designer laying out a personal photo-journal magazine page.

Design with intention: pace photos and text the way a print magazine would. Open strong with a hero, vary block sizes, group similar photos into galleries, and let occasional pull quotes break up text.

Refer to photos strictly by their 1-based index (the order they were shown to you).

Block types you may use:
- "hero": one feature photo + headline (+ optional subhead). Use exactly once, as the first block.
- "text": a paragraph of body copy in plain markdown (italics allowed via *asterisks*). Keep paragraphs tight — 2 to 5 sentences.
- "photo": a single photo with optional caption. "size" is "small" | "medium" | "full".
- "gallery": 2-9 related photos shown together with an optional shared caption. Prefer galleries over many sequential single-photo blocks — they read more like a magazine spread.
- "quote": a short pulled-quote drawn from or inspired by the user's summary.

Scale the layout to the photo count: roughly N/2 to N blocks for N photos, with a minimum of 5. Use every photo at least once across hero/photo/gallery (do not omit photos). With many photos (20+), lean on gallery blocks to group related shots.

If you are shown exactly ONE photo, it's an auto-generated editorial illustration — use it as the hero block. The rest of the layout should focus on text + 1-2 quote blocks to break up the body. Do not add additional photo or gallery blocks; you only have the one image.`;

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

export type CreatePageState = { error: string | null };

type IncomingPhoto = { publicId: string; width: number; height: number };

function cloudinaryAiUrl(publicId: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  // c_limit + w/h = preserve aspect, no upscale. q_auto + f_jpg keeps it small.
  return `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_${AI_MAX_EDGE},h_${AI_MAX_EDGE},q_85,f_jpg/${publicId}`;
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cloudinary fetch ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

// Manual creation: no AI, no API spend. Stores the author's rich body (from the
// Tiptap editor) as a single `richtext` block; inline images become Photo rows
// (first = cover) so the feed + archive work. Translation skipped.
export async function createPageManual(
  _prev: CreatePageState,
  formData: FormData,
): Promise<CreatePageState> {
  if (!(await isEditor())) return { error: "Sign in first." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const entryDateRaw = String(formData.get("entryDate") ?? "").trim();
  const entryDate = entryDateRaw
    ? new Date(`${entryDateRaw}T12:00:00.000Z`)
    : new Date();
  if (Number.isNaN(entryDate.getTime())) {
    return { error: "Please enter a valid entry date." };
  }
  if (!title) return { error: "Give your entry a title." };

  const intro = htmlToPlainText(body).slice(0, 200);
  const publicIds = extractCloudinaryPublicIds(body).slice(0, MAX_PHOTOS);

  const layout: Layout = {
    title,
    intro,
    blocks: [{ type: "richtext", html: body }],
  };

  let pageId: string;
  try {
    const page = await prisma.page.create({
      data: {
        title,
        summary: intro,
        layoutJson: JSON.stringify(layout),
        entryDate,
        photos: {
          create: publicIds.map((pid, i) => ({ filePath: pid, order: i })),
        },
      },
    });
    pageId = page.id;
  } catch (e) {
    console.error("createPageManual failed:", e);
    return {
      error: e instanceof Error ? e.message : "Failed to create the entry.",
    };
  }

  redirect(`/journal/${pageId}`);
}

export async function createPage(
  _prev: CreatePageState,
  formData: FormData,
): Promise<CreatePageState> {
  if (!(await isEditor())) return { error: "Sign in first." };

  const summary = String(formData.get("summary") ?? "").trim();
  const entryDateRaw = String(formData.get("entryDate") ?? "").trim();
  const entryDate = entryDateRaw
    ? new Date(`${entryDateRaw}T12:00:00.000Z`)
    : new Date();
  if (Number.isNaN(entryDate.getTime())) {
    return { error: "Please enter a valid entry date." };
  }

  // Photos arrive as JSON-encoded references from the browser's direct upload.
  const rawPhotoRefs = formData.getAll("photos");
  const photoRefs: IncomingPhoto[] = [];
  for (const raw of rawPhotoRefs) {
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
      // ignore malformed entries
    }
  }

  if (!summary) return { error: "Please add a summary of what happened." };
  if (photoRefs.length > MAX_PHOTOS)
    return { error: `Limit to ${MAX_PHOTOS} photos per page for now.` };
  if (photoRefs.length === 0 && !process.env.OPENAI_API_KEY) {
    return {
      error:
        "Add at least one photo, or configure OPENAI_API_KEY to auto-generate an illustration.",
    };
  }

  let pageId: string;
  try {
    const saved: { publicId: string; width: number; height: number; aiBase64: string }[] = [];

    // Zero-photo path: server-side generate one illustration via gpt-image-2.
    if (photoRefs.length === 0) {
      const openai = new OpenAI();
      const promptResp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 200,
        system: ILLUSTRATION_PROMPT_SYSTEM,
        messages: [{ role: "user", content: `Summary:\n${summary}` }],
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
      if (!b64) throw new Error("Image model returned no data.");
      const illustration = Buffer.from(b64, "base64");
      const upload = await uploadImage(illustration);
      saved.push({
        publicId: upload.publicId,
        width: upload.width,
        height: upload.height,
        aiBase64: illustration.toString("base64"),
      });
    } else {
      // Fetch a 1568px-edge JPEG of each photo from Cloudinary for the Claude
      // vision call. Cloudinary edge resizes for us — no sharp on the function.
      for (const ref of photoRefs) {
        const aiBase64 = await fetchAsBase64(cloudinaryAiUrl(ref.publicId));
        saved.push({ ...ref, aiBase64 });
      }
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

    // Translate for the language toggle — best-effort, so a translation hiccup
    // never blocks entry creation (rendering falls back to the original).
    let layoutEn: string | null = null;
    let layoutZh: string | null = null;
    try {
      const [en, zh] = await Promise.all([
        translateLayout(layout, "en"),
        translateLayout(layout, "zh"),
      ]);
      layoutEn = JSON.stringify(en);
      layoutZh = JSON.stringify(zh);
    } catch (e) {
      console.warn("createPage translation failed (entry still created):", e);
    }

    const page = await prisma.page.create({
      data: {
        title: layout.title,
        summary,
        layoutJson: JSON.stringify(layout),
        layoutEn,
        layoutZh,
        entryDate,
        photos: {
          create: saved.map((s, i) => ({
            filePath: s.publicId,
            width: s.width || null,
            height: s.height || null,
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

  redirect(`/journal/${pageId}`);
}
