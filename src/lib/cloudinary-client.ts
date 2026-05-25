"use client";

// Browser-side direct upload to Cloudinary. Bypasses our serverless function
// entirely (Vercel caps request bodies around ~4.5MB regardless of plan), so
// 50-photo batches go straight to the CDN at LAN speeds.

export type DirectUpload = {
  publicId: string;
  width: number;
  height: number;
  format: string;
};

export async function uploadToCloudinary(file: File): Promise<DirectUpload> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) {
    throw new Error(
      "Cloudinary direct upload not configured (missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET).",
    );
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", preset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: "POST", body: fd },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Cloudinary upload ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
  };
}
