"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// A thin accent bar at the very top that appears the instant an internal link
// is clicked and clears once the new route renders — so a click visibly
// "lands" even while the server is still working on the page.
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  // The route has settled — clear the bar.
  useEffect(() => {
    setActive(false);
  }, [pathname]);

  // Start the bar on any internal navigation click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      if (a.getAttribute("target") === "_blank") return;
      const dest = href.split("?")[0].split("#")[0];
      if (dest === pathname) return; // same page
      setActive(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      {active && (
        <div
          className="h-full bg-accent shadow-[0_0_8px] shadow-accent/50"
          style={{ animation: "navbar-grow 8s ease-out forwards" }}
        />
      )}
    </div>
  );
}
