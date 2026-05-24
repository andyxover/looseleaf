import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getCurrentUserEmail(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

// Super admin — the env-pinned account. Can manage editors + everything else.
export async function isOwner(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true; // dev fallback
  const email = await getCurrentUserEmail();
  if (!email || !process.env.OWNER_EMAIL) return false;
  return email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase();
}

// Owner OR anyone in the Editor table. Can create/edit/delete entries.
export async function isEditor(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true; // dev fallback
  const email = await getCurrentUserEmail();
  if (!email) return false;
  if (process.env.OWNER_EMAIL && email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase()) {
    return true;
  }
  const editor = await prisma.editor.findUnique({
    where: { email: email.toLowerCase() },
  });
  return Boolean(editor);
}

export async function requireOwner() {
  if (!(await isOwner())) {
    throw new Error("Unauthorized — owner only.");
  }
}

export async function requireEditor() {
  if (!(await isEditor())) {
    throw new Error("Unauthorized — editor access required.");
  }
}
