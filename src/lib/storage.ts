import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type UploadResult = {
  publicId: string;
  width: number;
  height: number;
  format: string;
};

const FOLDER = "looseleaf";
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function isCloudinaryConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

// Uploads to Cloudinary when configured; otherwise writes to public/uploads as
// a "/uploads/<uuid>.<ext>" path. Photo.filePath ends up holding either a
// Cloudinary public_id ("looseleaf/abc") or a leading-slash local path
// ("/uploads/abc.jpg"), and the PhotoImage component picks the right renderer.
export async function uploadImage(buffer: Buffer): Promise<UploadResult> {
  if (isCloudinaryConfigured()) return uploadToCloudinary(buffer);
  return saveLocally(buffer);
}

async function uploadToCloudinary(buffer: Buffer): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        resource_type: "image",
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      },
    );
    stream.end(buffer);
  });
}

async function saveLocally(buffer: Buffer): Promise<UploadResult> {
  const meta = await sharp(buffer).metadata();
  const fmt = (meta.format ?? "jpg").toString();
  const ext = fmt === "jpeg" ? "jpg" : fmt;
  const name = `${randomUUID()}.${ext}`;
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_UPLOAD_DIR, name), buffer);
  return {
    publicId: `/uploads/${name}`,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: ext,
  };
}

export async function deleteImage(publicId: string): Promise<void> {
  // Local-fallback paths start with "/"; cleanup is best-effort.
  if (publicId.startsWith("/")) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
