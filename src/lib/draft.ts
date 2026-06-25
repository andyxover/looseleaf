// Client-side draft persistence for the create form. Keeps the in-progress
// title/summary/body in localStorage so a failed submit, an accidental tab
// close, or a reload never costs the writeup. Cleared once an entry is
// actually created (see the pending-create marker below).

const DRAFT_KEY = "looseleaf:create-draft:v1";
// Set right before a create submit; consumed on the destination journal page
// to clear the draft only on a *confirmed* success (the create redirects there).
const PENDING_KEY = "looseleaf:create-pending";

export type CreateDraft = {
  mode: "ai" | "manual";
  title: string;
  summary: string;
  body: string; // manual-mode rich-text HTML
  entryDate: string;
};

// True if the draft holds any real text (ignore empty editor markup like
// "<p></p>"), so we never restore or persist a blank form.
export function draftHasContent(d: CreateDraft): boolean {
  const bodyText = d.body.replace(/<[^>]*>/g, "").trim();
  return Boolean(d.title.trim() || d.summary.trim() || bodyText);
}

export function loadDraft(): CreateDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && typeof d === "object") {
      return {
        mode: d.mode === "manual" ? "manual" : "ai",
        title: typeof d.title === "string" ? d.title : "",
        summary: typeof d.summary === "string" ? d.summary : "",
        body: typeof d.body === "string" ? d.body : "",
        entryDate: typeof d.entryDate === "string" ? d.entryDate : "",
      };
    }
  } catch {
    // corrupt JSON / disabled storage — treat as no draft
  }
  return null;
}

export function saveDraft(d: CreateDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // quota / disabled storage — best-effort
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// Marker handshake: a successful create redirects to /journal/[id], where the
// draft is cleared. Keeping the draft alive through the in-flight request means
// a crash or close mid-submit still preserves the text.
export function markPendingCreate(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearPendingCreate(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

// On the destination journal page: if a create was pending, the submit
// succeeded — clear both the marker and the saved draft. Returns true if it
// consumed a pending create.
export function consumePendingCreate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(PENDING_KEY)) {
      window.sessionStorage.removeItem(PENDING_KEY);
      clearDraft();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
