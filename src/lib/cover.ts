// Resolve a cover (Cloudinary public_id or local "/uploads/..." path) to a
// loadable URL at a given crop. Cloudinary serves auto-format, auto-gravity
// crops; local files are served as-is.
export function coverUrl(cover: string, w: number, h: number): string {
  if (cover.startsWith("/")) return cover;
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_${w},h_${h},g_auto,q_auto,f_auto/${cover}`;
}
