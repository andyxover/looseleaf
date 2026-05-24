"use client";

import Image, { type ImageProps } from "next/image";
import { CldImage } from "next-cloudinary";

// Unified image component:
// - paths starting with "/" → local file served from /public (legacy data)
// - anything else → Cloudinary public_id, rendered via CldImage
//
// This lets existing local entries keep working during the migration to Cloudinary,
// while new uploads go straight to the CDN.
export function PhotoImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  const isLocal = src.startsWith("/");
  if (isLocal) return <Image {...props} />;
  // CldImage accepts the same props as next/image; cast to satisfy its slightly
  // tighter src typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <CldImage {...(props as any)} />;
}
