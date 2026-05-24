import { redirect } from "next/navigation";

import { isOwner } from "@/lib/owner";
import CreateForm from "./CreateForm";

export default async function CreatePage() {
  if (!(await isOwner())) {
    redirect("/login?next=/create");
  }
  return <CreateForm />;
}
