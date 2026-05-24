import { redirect } from "next/navigation";

import { isEditor } from "@/lib/owner";
import CreateForm from "./CreateForm";

// Allow long-running server actions on this route: Sharp processing + multi-photo
// uploads + Claude vision + (optional) gpt-image-2 illustration can easily exceed
// Vercel's default 10s function timeout. 300s is Vercel's hard cap.
export const maxDuration = 300;

export default async function CreatePage() {
  if (!(await isEditor())) {
    redirect("/login?next=/create");
  }
  return <CreateForm />;
}
