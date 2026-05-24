import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { isOwner } from "@/lib/owner";
import { AdminPanel } from "./AdminPanel";

export default async function AdminPage() {
  if (!(await isOwner())) {
    redirect("/login?next=/admin");
  }
  const editors = await prisma.editor.findMany({
    orderBy: { addedAt: "desc" },
  });

  return (
    <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <h1 className="mt-6 font-serif text-4xl tracking-tight">Editors</h1>
      <p className="mt-2 text-zinc-500">
        Anyone you add here can sign in with Google and edit entries. The
        owner ({process.env.OWNER_EMAIL ?? "—"}) has full access by default.
      </p>
      <AdminPanel
        editors={editors.map((e) => ({
          email: e.email,
          addedAt: e.addedAt.toISOString(),
          addedBy: e.addedBy,
        }))}
      />
    </div>
  );
}
