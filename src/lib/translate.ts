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

// Translate one segment on its own. Used as a fallback when the batch call
// returns the wrong number of segments (happens on very long entries where the
// model fragments the array).
async function translateOne(text: string, target: string): Promise<string> {
  if (!text.trim()) return text;
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `Translate the user's text into natural, native ${target}. Keep "TCS", English proper nouns, markdown *emphasis*, and emoji intact. Localize idioms — don't translate word-for-word. Reply with ONLY the translation, no preamble.`,
    messages: [{ role: "user", content: text }],
  });
  return resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
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
  return applyStrings(layout, segments);
}
