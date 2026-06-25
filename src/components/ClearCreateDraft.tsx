"use client";

import { useEffect } from "react";
import { consumePendingCreate } from "@/lib/draft";

// Rendered on the journal entry page. A successful create redirects here, so
// if a create was pending we know it succeeded and can drop the saved draft.
// (A failed create returns to /create with the draft intact instead.)
export function ClearCreateDraft() {
  useEffect(() => {
    consumePendingCreate();
  }, []);
  return null;
}
