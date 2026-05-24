export type Framing = { x: number; y: number; scale: number };

export const DEFAULT_FRAMING: Framing = { x: 0.5, y: 0.5, scale: 1 };

export type Block =
  | {
      type: "hero";
      photoIdx: number;
      headline: string;
      subhead?: string;
      framing?: Framing;
    }
  | { type: "text"; markdown: string }
  | {
      type: "photo";
      photoIdx: number;
      caption?: string;
      size: "small" | "medium" | "full";
      framing?: Framing;
    }
  | {
      type: "gallery";
      photoIdxs: number[];
      spans?: number[];
      framings?: (Framing | null)[];
      caption?: string;
    }
  | { type: "quote"; text: string; attribution?: string };

export type Layout = {
  title: string;
  intro: string;
  blocks: Block[];
};
