"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [status, setStatus] = useState<"idle" | "redirecting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setStatus("redirecting");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Browser is being redirected to Google; nothing else to do here.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start sign-in.");
      setStatus("idle");
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <h1 className="mt-6 font-serif text-4xl tracking-tight">Sign in</h1>
      <p className="mt-2 text-zinc-500">
        Only the owner and approved editors can sign in.
      </p>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={status === "redirecting"}
        className="mt-10 inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {status === "redirecting" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        Continue with Google
      </button>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v3.2h5.5c-.2 1.5-1.7 4.5-5.5 4.5-3.3 0-6-2.7-6-6.1S8.7 6.5 12 6.5c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 4 14.7 3 12 3 6.9 3 2.8 7.1 2.8 12.1S6.9 21.2 12 21.2c6.9 0 9.2-4.8 9.2-7.3 0-.5 0-.9-.1-1.2H12z"
      />
    </svg>
  );
}
