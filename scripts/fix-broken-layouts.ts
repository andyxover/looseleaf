// Some bulk-imported pages have `layout.blocks` stored as a malformed
// stringified-JSON. Regenerate just the layout body for those pages by
// asking Claude to redesign from the summary, then re-link any existing
// photos as a hero/photo block at the start.

import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import type { Layout, Block } from "@/lib/layout";

const MODEL = "claude-sonnet-4-6";

const SYSTEM = `You design a magazine entry layout. Output ONLY through the submit_layout tool.

Block types:
- "text": markdown paragraph (italic via *asterisks*).
- "quote": pull-quote.

Use 4-8 blocks total, mixing text and 1-2 quotes. Do NOT use hero/photo/gallery blocks — those will be added by the system if applicable.`;

const tool = {
  name: "submit_layout",
  description: "Submit the layout.",
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
            type: { type: "string", enum: ["text", "quote"] },
            markdown: { type: "string" },
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
  const pages = await prisma.page.findMany({
    include: { photos: { orderBy: { order: "asc" } } },
  });
  const broken = pages.filter((p) => {
    try {
      const l = JSON.parse(p.layoutJson);
      return typeof l.blocks === "string";
    } catch {
      return true;
    }
  });
  console.log(`${broken.length} broken pages found.\n`);

  for (const page of broken) {
    console.log(`📄 ${page.title}`);
    const oldLayout = JSON.parse(page.layoutJson);
    try {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        tools: [tool],
        tool_choice: { type: "tool", name: "submit_layout" },
        messages: [
          {
            role: "user",
            content: `Title (keep as-is): ${page.title}\n\nIntro (keep as-is): ${oldLayout.intro ?? ""}\n\nSummary / source text:\n\n${page.summary}\n\nWrite a tight 4-8 block layout (text + quote only).`,
          },
        ],
      });
      const toolUse = resp.content.find(
        (b) => b.type === "tool_use",
      ) as { input?: Partial<Layout> } | undefined;
      if (!toolUse?.input) {
        console.log("   ❌ no tool_use returned");
        continue;
      }
      const newLayout: Layout = {
        title: toolUse.input.title ?? page.title,
        intro: toolUse.input.intro ?? oldLayout.intro ?? "",
        blocks: (toolUse.input.blocks ?? []) as Block[],
      };

      // Prepend a photo block for the first photo (the auto-illust), if any.
      if (page.photos.length > 0) {
        newLayout.blocks.unshift({
          type: "photo",
          photoIdx: page.photos[0].order + 1,
          size: "full",
          caption: "",
        });
      }

      await prisma.page.update({
        where: { id: page.id },
        data: { layoutJson: JSON.stringify(newLayout) },
      });
      console.log(
        `   ✅ regenerated: ${newLayout.blocks.length} blocks${page.photos.length > 0 ? " (with photo)" : ""}`,
      );
    } catch (e) {
      console.log(`   ❌ ${e instanceof Error ? e.message : e}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
