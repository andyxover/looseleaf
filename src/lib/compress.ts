import imageCompression from "browser-image-compression";

const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.85,
};

// Browser-side: resize + recompress before upload so we don't blow past
// Vercel's request-body limit (100MB on Pro) for 30+ photo batches. A typical
// phone photo (3-5MB at 4032px) drops to ~300-700KB at 1920px q0.85.
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const out = await imageCompression(file, DEFAULT_OPTIONS);
    // The library returns a File in modern versions; this guards against
    // legacy Blob returns just in case.
    if (out instanceof File) return out;
    const blob = out as unknown as Blob;
    return new File([blob], file.name, { type: blob.type || file.type });
  } catch (e) {
    console.warn("compressImage: falling back to original for", file.name, e);
    return file;
  }
}

export async function compressMany(files: File[]): Promise<File[]> {
  // Sequential keeps memory in check on weaker devices. With useWebWorker:true
  // browser-image-compression still parallelises the actual work off the main
  // thread.
  const out: File[] = [];
  for (const f of files) out.push(await compressImage(f));
  return out;
}
