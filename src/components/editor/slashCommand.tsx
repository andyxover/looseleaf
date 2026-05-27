"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, {
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  ImagePlus,
} from "lucide-react";

import { SlashList, type SlashItem, type SlashListHandle } from "./SlashList";

export type SlashOptions = { onInsertImage: () => void };

function buildItems(query: string, onInsertImage: () => void): SlashItem[] {
  const all: SlashItem[] = [
    {
      title: "Heading",
      icon: <Heading2 className="size-4" />,
      run: (e, r) =>
        (e as Editor).chain().focus().deleteRange(r as Range).toggleHeading({ level: 2 }).run(),
    },
    {
      title: "Subheading",
      icon: <Heading3 className="size-4" />,
      run: (e, r) =>
        (e as Editor).chain().focus().deleteRange(r as Range).toggleHeading({ level: 3 }).run(),
    },
    {
      title: "Bullet list",
      icon: <List className="size-4" />,
      run: (e, r) =>
        (e as Editor).chain().focus().deleteRange(r as Range).toggleBulletList().run(),
    },
    {
      title: "Numbered list",
      icon: <ListOrdered className="size-4" />,
      run: (e, r) =>
        (e as Editor).chain().focus().deleteRange(r as Range).toggleOrderedList().run(),
    },
    {
      title: "Quote",
      icon: <Quote className="size-4" />,
      run: (e, r) =>
        (e as Editor).chain().focus().deleteRange(r as Range).toggleBlockquote().run(),
    },
    {
      title: "Divider",
      icon: <Minus className="size-4" />,
      run: (e, r) =>
        (e as Editor).chain().focus().deleteRange(r as Range).setHorizontalRule().run(),
    },
    {
      title: "Photo",
      icon: <ImagePlus className="size-4" />,
      run: (e, r) => {
        (e as Editor).chain().focus().deleteRange(r as Range).run();
        onInsertImage();
      },
    },
  ];
  const q = query.toLowerCase().trim();
  return q ? all.filter((i) => i.title.toLowerCase().includes(q)) : all;
}

function place(popup: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.left = `${rect.left}px`;
}

export const SlashCommand = Extension.create<SlashOptions>({
  name: "slashCommand",
  addOptions() {
    return { onInsertImage: () => {} };
  },
  addProseMirrorPlugins() {
    const onInsertImage = this.options.onInsertImage;
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: "/",
        command: ({ editor, range, props }) => props.run(editor, range),
        items: ({ query }) => buildItems(query, onInsertImage),
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: HTMLDivElement | null = null;
          return {
            onStart: (props: SuggestionProps<SlashItem>) => {
              component = new ReactRenderer(SlashList, {
                props: {
                  items: props.items,
                  command: (item: SlashItem) => props.command(item),
                },
                editor: props.editor,
              });
              popup = document.createElement("div");
              popup.style.position = "fixed";
              popup.style.zIndex = "60";
              document.body.appendChild(popup);
              popup.appendChild(component.element);
              place(popup, props.clientRect?.());
            },
            onUpdate: (props: SuggestionProps<SlashItem>) => {
              component?.updateProps({
                items: props.items,
                command: (item: SlashItem) => props.command(item),
              });
              place(popup!, props.clientRect?.());
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                popup?.remove();
                return true;
              }
              return (
                (component?.ref as SlashListHandle | undefined)?.onKeyDown({
                  event: props.event,
                }) ?? false
              );
            },
            onExit: () => {
              popup?.remove();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
