"use client";

import { useEffect, useRef } from "react";

import { recordView } from "@/app/engagement-actions";

// Fires a single view increment on mount. Skips editors/owner so they don't
// inflate their own counts. Renders nothing.
export function ViewCounter({ pageId, skip }: { pageId: string; skip?: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (skip || fired.current) return;
    fired.current = true;
    recordView(pageId).catch(() => {});
  }, [pageId, skip]);
  return null;
}
