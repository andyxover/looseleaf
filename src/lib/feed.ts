// Shared helpers for the home feed: group Pages into magazine-style spreads.

import type { Layout, Block } from "@/lib/layout";

export type FeedEntry = {
  id: string;
  title: string;
  intro: string;
  date: string; // ISO
  cover?: string | null; // Cloudinary public_id or local "/uploads/..." path
  photoCount: number;
  views: number;
  likeCount: number;
  liked: boolean;
  quote?: { text: string; attribution?: string } | null;
};

export type Spread =
  | { type: "featured"; entry: FeedEntry }
  | { type: "monthHeader"; label: string; count: number }
  | { type: "magazine"; entries: FeedEntry[] }
  | { type: "pullQuote"; entry: FeedEntry; quote: { text: string; attribution?: string } }
  | { type: "list"; entries: FeedEntry[] };

// Pull a single quote from an entry's layout if any quote block exists.
function extractQuote(blocks: Block[]): { text: string; attribution?: string } | null {
  const quotes = blocks.filter(
    (b): b is Extract<Block, { type: "quote" }> => b.type === "quote",
  );
  if (quotes.length === 0) return null;
  // Prefer the first one — usually the most representative.
  return { text: quotes[0].text, attribution: quotes[0].attribution };
}

type RawPage = {
  id: string;
  title: string;
  entryDate: Date;
  layoutJson: string;
  photos: { filePath: string }[];
  _photoCount: number;
  views: number;
  _likeCount: number;
  _liked: boolean;
};

export function pageToEntry(p: RawPage): FeedEntry {
  let intro = "";
  let quote: FeedEntry["quote"] = null;
  // `layoutJson` here is the language-resolved layout, so the title/intro/quote
  // come out already translated. Fall back to the row's title if the layout
  // has none.
  let title = p.title;
  try {
    const layout = JSON.parse(p.layoutJson) as Layout;
    if (typeof layout.title === "string" && layout.title.trim()) {
      title = layout.title;
    }
    intro = typeof layout.intro === "string" ? layout.intro : "";
    if (Array.isArray(layout.blocks)) {
      quote = extractQuote(layout.blocks);
      if (!intro) {
        const firstText = layout.blocks.find(
          (b): b is Extract<Block, { type: "text" }> => b.type === "text",
        );
        if (firstText) intro = firstText.markdown.slice(0, 200);
      }
    }
  } catch {
    // ignore malformed layouts
  }
  return {
    id: p.id,
    title,
    intro,
    date: p.entryDate.toISOString(),
    cover: p.photos[0]?.filePath ?? null,
    photoCount: p._photoCount,
    views: p.views,
    likeCount: p._likeCount,
    liked: p._liked,
    quote,
  };
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "2025-04"
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(`${y}-${m}-15T12:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
}

// Build a chronological list of spreads from a list of entries (newest first).
// `featuredFirst` should be true for the first batch so the latest gets the
// big cover treatment.
export function buildSpreads(
  entries: FeedEntry[],
  featuredFirst: boolean,
): Spread[] {
  if (entries.length === 0) return [];
  const spreads: Spread[] = [];

  let start = 0;
  if (featuredFirst) {
    spreads.push({ type: "featured", entry: entries[0] });
    start = 1;
  }

  // Group remaining entries by month.
  const groups: { key: string; entries: FeedEntry[] }[] = [];
  for (let i = start; i < entries.length; i++) {
    const k = monthKey(entries[i].date);
    if (groups.length === 0 || groups[groups.length - 1].key !== k) {
      groups.push({ key: k, entries: [entries[i]] });
    } else {
      groups[groups.length - 1].entries.push(entries[i]);
    }
  }

  // For each month, emit header + a layout (magazine for newer, list for
  // older), and inject a pull quote every few groups for editorial rhythm.
  groups.forEach((g, idx) => {
    spreads.push({
      type: "monthHeader",
      label: monthLabel(g.key),
      count: g.entries.length,
    });
    // First 2 month-groups get the magazine spread; older months use the
    // compact list.
    const useMagazine = idx < 2;
    if (useMagazine) {
      spreads.push({ type: "magazine", entries: g.entries });
    } else {
      spreads.push({ type: "list", entries: g.entries });
    }

    // Inject a pull-quote after every other group, drawn from a random entry
    // with a quote in that group.
    if (idx % 2 === 1) {
      const withQuote = g.entries.filter((e) => e.quote && e.quote.text.length > 0);
      if (withQuote.length > 0) {
        const pick = withQuote[Math.floor(Math.random() * withQuote.length)];
        if (pick.quote) {
          spreads.push({ type: "pullQuote", entry: pick, quote: pick.quote });
        }
      }
    }
  });

  return spreads;
}
