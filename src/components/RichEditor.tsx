"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import ImageExt from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  ImagePlus,
  Link2,
  Loader2,
} from "lucide-react";

import { compressImage } from "@/lib/compress";
import { uploadToCloudinary } from "@/lib/cloudinary-client";
import { SlashCommand } from "@/components/editor/slashCommand";

function cloudUrl(publicId: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_1600/${publicId}`;
}

// A clean document editor styled to match the journal's reading view. Write
// freely; paste, drag, or insert photos and they upload to Cloudinary and drop
// inline into the body.
export function RichEditor({
  initialHTML,
  onChange,
}: {
  initialHTML?: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function uploadFiles(files: FileList | null | undefined) {
    const ed = editorRef.current;
    if (!ed || !files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const file of images) {
      setUploading((n) => n + 1);
      try {
        const compressed = await compressImage(file);
        const { publicId } = await uploadToCloudinary(compressed);
        ed.chain().focus().setImage({ src: cloudUrl(publicId) }).run();
      } catch (e) {
        console.error("inline image upload failed", e);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      ImageExt.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder: 'Write your story… type "/" for blocks, or paste a photo.',
      }),
      SlashCommand.configure({
        onInsertImage: () => fileInputRef.current?.click(),
      }),
    ],
    content: initialHTML ?? "",
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "richtext min-h-[50vh] max-w-none focus:outline-none",
      },
      handlePaste(_view, event) {
        const files = event.clipboardData?.files;
        if (
          files &&
          files.length > 0 &&
          Array.from(files).some((f) => f.type.startsWith("image/"))
        ) {
          void uploadFiles(files);
          return true;
        }
        return false;
      },
      handleDrop(_view, event) {
        const dt = (event as DragEvent).dataTransfer;
        const files = dt?.files;
        if (
          files &&
          files.length > 0 &&
          Array.from(files).some((f) => f.type.startsWith("image/"))
        ) {
          event.preventDefault();
          void uploadFiles(files);
          return true;
        }
        return false;
      },
    },
  });

  function setLink() {
    if (!editor) return;
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const btn =
    "grid size-9 place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
  const btnActive = "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";

  function tbBtn(active: boolean) {
    return `${btn} ${active ? btnActive : ""}`;
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      {editor && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t-xl border-b border-zinc-200 bg-white/90 px-2 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={tbBtn(editor.isActive("bold"))} aria-label="Bold">
            <Bold className="size-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={tbBtn(editor.isActive("italic"))} aria-label="Italic">
            <Italic className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={tbBtn(editor.isActive("heading", { level: 2 }))} aria-label="Heading">
            <Heading2 className="size-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={tbBtn(editor.isActive("heading", { level: 3 }))} aria-label="Subheading">
            <Heading3 className="size-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={tbBtn(editor.isActive("blockquote"))} aria-label="Quote">
            <Quote className="size-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={tbBtn(editor.isActive("bulletList"))} aria-label="Bullet list">
            <List className="size-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={tbBtn(editor.isActive("orderedList"))} aria-label="Numbered list">
            <ListOrdered className="size-4" />
          </button>
          <button type="button" onClick={setLink} className={tbBtn(editor.isActive("link"))} aria-label="Link">
            <Link2 className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className={btn} aria-label="Insert photo">
            <ImagePlus className="size-4" />
          </button>
          {uploading > 0 && (
            <span className="ml-1 inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Uploading…
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {editor && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={tbBtn(editor.isActive("bold"))} aria-label="Bold">
            <Bold className="size-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={tbBtn(editor.isActive("italic"))} aria-label="Italic">
            <Italic className="size-4" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={tbBtn(editor.isActive("heading", { level: 2 }))} aria-label="Heading">
            <Heading2 className="size-4" />
          </button>
          <button type="button" onClick={setLink} className={tbBtn(editor.isActive("link"))} aria-label="Link">
            <Link2 className="size-4" />
          </button>
        </BubbleMenu>
      )}
      <div className="px-5 py-5 sm:px-7 sm:py-7">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
