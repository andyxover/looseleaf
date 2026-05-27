"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from "react";

export type SlashItem = {
  title: string;
  icon: ReactNode;
  run: (editor: unknown, range: unknown) => void;
};

export type SlashListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export const SlashList = forwardRef<
  SlashListHandle,
  { items: SlashItem[]; command: (item: SlashItem) => void }
>(function SlashList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selected]) command(items[selected]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className="w-60 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            command(item);
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
            i === selected
              ? "bg-zinc-100 dark:bg-zinc-900"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
          }`}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            {item.icon}
          </span>
          {item.title}
        </button>
      ))}
    </div>
  );
});
