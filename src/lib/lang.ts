import { cookies } from "next/headers";

export type Lang = "en" | "zh";

// Reads the viewer's language preference from the `lang` cookie. Default: en.
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get("lang")?.value === "zh" ? "zh" : "en";
}

type Translatable = {
  layoutJson: string;
  layoutEn?: string | null;
  layoutZh?: string | null;
};

// Pick the layout JSON for the chosen language, falling back to the original
// when a translation hasn't been generated yet.
export function resolveLayoutJson(page: Translatable, lang: Lang): string {
  if (lang === "en" && page.layoutEn) return page.layoutEn;
  if (lang === "zh" && page.layoutZh) return page.layoutZh;
  return page.layoutJson;
}
