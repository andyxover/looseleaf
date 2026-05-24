import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

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

export async function isOwner(): Promise<boolean> {
  // Dev fallback: if Supabase isn't configured yet, treat the local user as owner
  // so the app keeps working before the cloud setup is finished.
  if (!isSupabaseConfigured()) return true;
  const email = await getCurrentUserEmail();
  if (!process.env.OWNER_EMAIL) return false;
  return email === process.env.OWNER_EMAIL;
}

export async function requireOwner() {
  if (!(await isOwner())) {
    throw new Error("Unauthorized — owner only.");
  }
}
