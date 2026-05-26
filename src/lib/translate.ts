import { anthropic } from "@/lib/anthropic";
import type { Layout, Block } from "@/lib/layout";

export type Lang = "en" | "zh";

const MODEL = "claude-sonnet-4-6";

// Collect every human-readable string from a layout, in a fixed traversal
// order. applyStrings() must walk blocks in the exact same order.
function collectStrings(layout: Layout): string[] {
  const out: string[] = [layout.title ?? "", layout.intro ?? ""];
  for (const b of layout.blocks) {
    switch (b.type) {
      case "hero":
        out.push(b.headline ?? "", b.subhead ?? "");
        break;
      case "text":
        out.push(b.markdown ?? "");
        break;
      case "photo":
        out.push(b.caption ?? "");
        break;
      case "gallery":
        out.push(b.caption ?? "");
        break;
      case "quote":
        out.push(b.text ?? "", b.attribution ?? "");
        break;
    }
  }
  return out;
}

function applyStrings(layout: Layout, s: string[]): Layout {
  // Deep clone so we never mutate the source layout.
  const next: Layout = JSON.parse(JSON.stringify(layout));
  let i = 0;
  next.title = s[i++] ?? next.title;
  next.intro = s[i++] ?? next.intro;
  for (const b of next.blocks as Block[]) {
    switch (b.type) {
      case "hero":
        b.headline = s[i++] ?? b.headline;
        b.subhead = s[i++] || undefined;
        break;
      case "text":
        b.markdown = s[i++] ?? b.markdown;
        break;
      case "photo":
        b.caption = s[i++] || undefined;
        break;
      case "gallery":
        b.caption = s[i++] || undefined;
        break;
      case "quote":
        b.text = s[i++] ?? b.text;
        b.attribution = s[i++] || undefined;
        break;
    }
  }
  return next;
}

const SYSTEM = (target: string) => `You are a literary translator localizing a personal photo-journal magazine entry into natural, native ${target}.

You'll receive a JSON array of text segments. Translate each into ${target} and return an array of the SAME length in the SAME order via the submit_translation tool.

Rules:
- Sound native and editorial — localize idioms, tone, and rhythm. Never word-for-word.
- Translate each segment FAITHFULLY at the same scope and length. A title stays a one-line title; a caption stays a caption. NEVER expand a short headline into paragraphs, continue the text, invent new sentences, or echo the original alongside the translation.
- Keep "TCS" and English proper nouns intact (program names, people, places, grade labels like "G8" / "Grade 11", "Terry Fox", university names).
- Preserve markdown emphasis (*italics*) and emoji exactly where they appear.
- If a segment is ALREADY in ${target}, return it lightly polished — do not re-translate it awkwardly.
- Empty strings must stay empty strings.
- Do not add, drop, merge, or reorder segments. Output length MUST equal input length.`;

const tool = {
  name: "submit_translation",
  description: "Return the translated text segments, same length and order as the input.",
  input_schema: {
    type: "object" as const,
    properties: {
      segments: { type: "array", items: { type: "string" } },
    },
    required: ["segments"],
  },
};

async function batchTranslate(
  strings: string[],
  target: string,
): Promise<string[] | null> {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: SYSTEM(target),
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_translation" },
    messages: [{ role: "user", content: JSON.stringify(strings) }],
  });
  const toolUse = resp.content.find((b) => b.type === "tool_use");
  const segments = (toolUse?.input as { segments?: string[] } | undefined)
    ?.segments;
  return segments && segments.length === strings.length ? segments : null;
}

const oneTool = {
  name: "submit_translation",
  description:
    "Return the faithful translation of EXACTLY the provided text segment — same meaning, same scope, same length register. Do NOT add, continue, elaborate, or invent sentences. Do NOT include the original text. A title stays a title; a caption stays a caption.",
  input_schema: {
    type: "object" as const,
    properties: { translation: { type: "string" } },
    required: ["translation"],
  },
};

const cjkCount = (s: string) => (s.match(/[一-鿿]/g) ?? []).length;

// A translated segment is "corrupt" when the model ignored the translate task
// and instead generated an article — merging the body into a title/headline,
// continuing the text, or leaving the source untranslated. Used to self-heal
// individual segments.
function looksCorrupt(input: string, output: string, target: string): boolean {
  const inp = input.trim();
  // A short single-line segment (title, headline, caption, short quote) must
  // stay single-line. If it had no break but the translation sprouted a line
  // break or '---' rule AND grew meaningfully, the model merged/continued it.
  if (
    inp.length < 200 &&
    !inp.includes("\n") &&
    (output.includes("\n") || output.includes("---")) &&
    output.length > inp.length * 1.8
  ) {
    return true;
  }
  // Extreme balloon on any segment — the model generated an article.
  if (output.length > input.length * 4 + 200) return true;
  // English output left substantially in Chinese was never translated. Strip
  // TCS's official Chinese name first — it's a proper noun we deliberately keep
  // in bylines, and shouldn't count as "untranslated". Use a ratio so a stray
  // preserved name doesn't trip it; only a real Chinese sentence does.
  if (target.startsWith("English")) {
    const stripped = output.replace(/探索未來(國際)?實驗教育機構/g, "");
    if (stripped.length > 0 && cjkCount(stripped) / stripped.length > 0.3) {
      return true;
    }
  }
  return false;
}

// Translate one segment on its own via a structured tool call — the framing
// keeps the model from expanding a short headline into a whole article. Used
// as a fallback when the batch returns the wrong count, and to heal any single
// segment that came back corrupt.
async function translateOne(text: string, target: string): Promise<string> {
  if (!text.trim()) return text;
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You translate discrete CMS text segments into natural, native ${target}. Each request is ONE segment (a title, heading, caption, quote, or paragraph). Translate ONLY that segment, faithfully and at the same length — never expand a headline into an article, never continue the text, never append the source. Keep "TCS", English proper nouns, markdown *emphasis*, and emoji intact. Submit via the tool.`,
    tools: [oneTool],
    tool_choice: { type: "tool", name: "submit_translation" },
    messages: [{ role: "user", content: text }],
  });
  const tu = resp.content.find((b) => b.type === "tool_use");
  return (
    (tu?.input as { translation?: string } | undefined)?.translation ?? ""
  ).trim();
}

// Translate a layout's text into the target language, preserving all structure
// (block order, types, photoIdx/photoIdxs, size, spans, framing).
export async function translateLayout(
  layout: Layout,
  lang: Lang,
): Promise<Layout> {
  const target = lang === "en" ? "English" : "Traditional Chinese (繁體中文)";
  const strings = collectStrings(layout);
  if (strings.every((s) => s.trim() === "")) return layout;

  let segments = await batchTranslate(strings, target);
  if (!segments) {
    // Fallback: translate each segment individually — bulletproof on count.
    segments = [];
    for (const s of strings) segments.push(await translateOne(s, target));
  }
  // Self-heal: re-translate any single segment the model turned into an
  // article (ballooned + source echoed). One bad segment shouldn't taint the
  // whole entry, and re-doing just that segment is cheap.
  for (let i = 0; i < segments.length; i++) {
    if (looksCorrupt(strings[i], segments[i], target)) {
      segments[i] = await translateOne(strings[i], target);
    }
  }
  return applyStrings(layout, segments);
}
