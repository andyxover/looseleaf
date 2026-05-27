// Helpers for the rich ("Build it myself") body stored as HTML.

// Pull Cloudinary public_ids out of inline <img> tags, in document order,
// de-duplicated. The editor inserts URLs shaped like
// .../image/upload/<transforms>/<publicId>; public_ids may contain folders.
export function extractCloudinaryPublicIds(html: string): string[] {
  const re = /res\.cloudinary\.com\/[^/]+\/image\/upload\/[^/"']+\/([^"'\s)]+)/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = decodeURIComponent(m[1]);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
