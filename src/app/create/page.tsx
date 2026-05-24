import { redirect } from "next/navigation";

import { isEditor } from "@/lib/owner";
import CreateForm from "./CreateForm";

export default async function CreatePage() {
  if (!(await isEditor())) {
    redirect("/login?next=/create");
  }
  return <CreateForm />;
}
