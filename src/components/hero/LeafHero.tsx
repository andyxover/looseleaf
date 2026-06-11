"use client";

// "Leafing Through" — the pinned 3D hero. The visitor starts inside a shallow
// room built with CSS perspective: a cinematic paper-film plays deep in the
// background, real journal photos hang in the air as loose printed leaves, and
// the wordmark sits center stage. Scroll pushes the camera forward — leaves
// tumble past and out of frame, the wordmark letters part like a doorway (the
// vermilion period holds out last), and the tagline + search surface as the
// scene settles into the feed below. Mouse movement tilts the whole room, and
// preserve-3d turns that tilt into true depth parallax for free.
//
// Everything is DOM + CSS 3D (no WebGL): text stays crisp, the leaves are real
// links into their entries, and the scene degrades to a composed static layout
// when JS or motion is unavailable.

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { coverUrl } from "@/lib/cover";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export type HeroLeaf = {
  id: string;
  src: string; // cover (Cloudinary id or local path)
  title: string;
  date: string; // ISO
};

// Hand-placed slots around a center "hole" the wordmark lives in.
// x/y: center position in %, z: resting depth (px), r: resting rotation,
// dx/dy: exit drift (vw/vh), s: size factor, near leaves exit sooner.
const SLOTS = [
  { x: 13, y: 24, z: -460, r: -7, dx: -38, dy: -18, s: 1.0, mobile: true },
  { x: 79, y: 17, z: -330, r: 5, dx: 32, dy: -24, s: 0.9, mobile: true },
  { x: 87, y: 63, z: -540, r: 9, dx: 42, dy: 18, s: 1.05, mobile: false },
  { x: 9, y: 70, z: -230, r: -11, dx: -36, dy: 26, s: 0.85, mobile: true },
  { x: 30, y: 86, z: -410, r: 4, dx: -18, dy: 38, s: 0.95, mobile: false },
  { x: 68, y: 87, z: -170, r: -5, dx: 24, dy: 40, s: 0.8, mobile: true },
  { x: 50, y: 9, z: -610, r: 3, dx: 6, dy: -42, s: 1.1, mobile: false },
  { x: 22, y: 47, z: -700, r: -3, dx: -46, dy: 2, s: 1.15, mobile: false },
  { x: 91, y: 40, z: -140, r: 12, dx: 46, dy: -8, s: 0.75, mobile: true },
  { x: 60, y: 56, z: -760, r: -8, dx: 26, dy: 16, s: 1.2, mobile: false },
];

const WORD = "Looseleaf";

function dateLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export function LeafHero({
  leaves,
  filmSrc,
  children,
}: {
  leaves: HeroLeaf[];
  filmSrc: string | null;
  children?: React.ReactNode; // tagline + search block, revealed at the end
}) {
  const rootRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLHeadingElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const outro = outroRef.current!;

    if (reduced) {
      // Static composition: everything at rest, outro readable immediately.
      gsap.set(outro, { autoAlpha: 1 });
      return;
    }

    const leafWraps = Array.from(
      root.querySelectorAll<HTMLElement>("[data-leaf]"),
    );
    const leafCards = Array.from(
      root.querySelectorAll<HTMLElement>("[data-leaf-card]"),
    );
    const letters = Array.from(
      wordRef.current!.querySelectorAll<HTMLElement>("[data-letter]"),
    );
    const period = wordRef.current!.querySelector<HTMLElement>("[data-period]")!;

    const ctx = gsap.context(() => {
      // --- Resting state ----------------------------------------------------
      leafWraps.forEach((el, i) => {
        const slot = SLOTS[i % SLOTS.length];
        gsap.set(el, {
          xPercent: -50,
          yPercent: -50,
          z: slot.z,
          rotation: slot.r,
          force3D: true,
        });
      });
      gsap.set(filmRef.current, { xPercent: -50, yPercent: -50, z: -700, scale: 1.85 });
      gsap.set(veilRef.current, { opacity: 0.55 });
      gsap.set(outro, { autoAlpha: 0, y: 28 });

      // --- Entrance: the room assembles -------------------------------------
      gsap.from(letters, {
        y: 70,
        autoAlpha: 0,
        rotation: -6,
        stagger: 0.05,
        duration: 0.7,
        ease: "power3.out",
        delay: 0.15,
      });
      gsap.from(period, {
        scale: 0,
        autoAlpha: 0,
        duration: 0.5,
        ease: "back.out(3)",
        delay: 0.15 + 0.05 * WORD.length,
      });
      gsap.from(leafWraps, {
        autoAlpha: 0,
        duration: 1.1,
        stagger: 0.07,
        ease: "power2.out",
        delay: 0.3,
      });

      // Idle bob lives on the inner card so it never fights the scrubbed
      // transform on the wrapper.
      const bobs = leafCards.map((el, i) =>
        gsap.to(el, {
          y: i % 2 === 0 ? 9 : -9,
          rotation: i % 3 === 0 ? 1.4 : -1.2,
          duration: 2.8 + (i % 5) * 0.45,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        }),
      );

      // --- The scrubbed fly-through ------------------------------------------
      // Timeline time is in abstract units (0..10); scrub maps scroll to it.
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "+=260%",
          scrub: 1.1,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            if (counterRef.current) {
              counterRef.current.textContent = String(
                Math.round(self.progress * 100),
              ).padStart(3, "0");
            }
          },
        },
      });

      // The hint dies the moment the journey starts.
      tl.to(hintRef.current, { autoAlpha: 0, duration: 0.5 }, 0);

      // Leaves sweep past the camera in a loose cascade. Nearer leaves leave
      // earlier; deep ones surface late so there's always something passing.
      leafWraps.forEach((el, i) => {
        const slot = SLOTS[i % SLOTS.length];
        const at = 0.3 + (i % 5) * 0.62;
        tl.to(
          el,
          {
            z: 950 * slot.s,
            x: `${slot.dx}vw`,
            y: `${slot.dy}vh`,
            rotation: slot.r * 3.4,
            rotationY: slot.dx > 0 ? 26 : -26,
            duration: 3.4,
            ease: "power1.in",
          },
          at,
        );
        // Snuff it just before it would cross the camera plane.
        tl.to(el, { autoAlpha: 0, duration: 0.5 }, at + 2.9);
      });

      // The film drifts closer the whole way, then dims under the veil so the
      // scene hands off to flat paper.
      tl.to(filmRef.current, { z: -340, scale: 1.45, duration: 10 }, 0);
      tl.to(veilRef.current, { opacity: 0.94, duration: 2.6 }, 7.2);

      // The wordmark parts from the edges in — a doorway you fly through.
      tl.to(
        letters,
        {
          z: 880,
          yPercent: (i) => (i % 2 === 0 ? -46 : 38),
          rotationY: (i) => (i < letters.length / 2 ? -20 : 20),
          duration: 2.7,
          ease: "power1.in",
          stagger: { each: 0.26, from: "edges" },
        },
        3.1,
      );
      tl.to(
        letters,
        {
          autoAlpha: 0,
          duration: 0.55,
          stagger: { each: 0.26, from: "edges" },
        },
        3.1 + 2.2,
      );

      // The vermilion period is the last thing standing: it swells, holds the
      // center beat, then pops out of the way.
      tl.to(period, { scale: 2.1, z: 300, duration: 1.6, ease: "power1.in" }, 5.6);
      tl.to(period, { autoAlpha: 0, scale: 2.8, duration: 0.6 }, 7.1);

      // And the page introduces itself.
      tl.to(outro, { autoAlpha: 1, y: 0, duration: 1.7, ease: "power2.out" }, 7.4);

      // --- Mouse parallax: tilt the whole room -------------------------------
      const rx = gsap.quickTo(tiltRef.current, "rotationX", {
        duration: 0.9,
        ease: "power3.out",
      });
      const ry = gsap.quickTo(tiltRef.current, "rotationY", {
        duration: 0.9,
        ease: "power3.out",
      });
      function onPointerMove(e: PointerEvent) {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        ry(nx * 4.6);
        rx(ny * -3.6);
      }
      window.addEventListener("pointermove", onPointerMove);

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        bobs.forEach((b) => b.kill());
      };
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative h-screen overflow-hidden bg-paper dark:bg-paper-dark"
    >
      {/* The 3D room. Perspective on the outer node, preserve-3d inside. */}
      <div
        ref={tiltRef}
        className="absolute inset-0 will-change-transform [transform-style:preserve-3d]"
        style={{ perspective: "1200px" }}
      >
        <div className="absolute inset-0 [transform-style:preserve-3d]">
          {/* Deep backdrop: the paper film, washed toward the page ground. */}
          <div
            ref={filmRef}
            className="absolute left-1/2 top-1/2 h-[120%] w-[120%] will-change-transform"
          >
            {filmSrc ? (
              <video
                src={filmSrc}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover opacity-90 saturate-[0.85]"
              />
            ) : (
              /* No film yet: a warm gradient stands in so the depth still reads. */
              <div className="h-full w-full bg-[radial-gradient(ellipse_at_50%_42%,#f3e8d2_0%,#ecdfc6_38%,#f6f2ea_78%)] dark:bg-[radial-gradient(ellipse_at_50%_42%,#1c1713_0%,#15110e_45%,#0c0a09_80%)]" />
            )}
            <div
              ref={veilRef}
              className="absolute inset-0 bg-paper dark:bg-paper-dark"
            />
          </div>

          {/* The loose leaves — real entries, hanging in the air. */}
          {leaves.map((leaf, i) => {
            const slot = SLOTS[i % SLOTS.length];
            return (
              <div
                key={leaf.id}
                data-leaf
                className={`absolute will-change-transform ${
                  slot.mobile ? "" : "hidden md:block"
                }`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `calc(${slot.s} * clamp(120px, 15vw, 230px))`,
                  transform: `translate(-50%, -50%) rotate(${slot.r}deg)`,
                }}
              >
                <div data-leaf-card className="will-change-transform">
                  <Link
                    href={`/journal/${leaf.id}`}
                    className="group block rounded-[3px] bg-white p-2 pb-7 shadow-[0_24px_60px_-18px_rgba(28,18,8,0.38)]"
                    tabIndex={-1}
                    aria-label={leaf.title}
                  >
                    <div className="overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverUrl(leaf.src, 480, 360)}
                        alt=""
                        loading="eager"
                        className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                        draggable={false}
                      />
                    </div>
                    <div className="absolute inset-x-2 bottom-1.5 flex items-baseline justify-between font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-500">
                      <span className="truncate">{dateLabel(leaf.date)}</span>
                      <span className="pl-2 text-accent">
                        №{String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}

          {/* The wordmark plane — letters part in 3D as you pass through. */}
          <div className="absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]">
            <h1
              ref={wordRef}
              aria-label={`${WORD}.`}
              className="select-none text-center font-serif text-[3.5rem] font-black leading-[0.95] tracking-[-0.04em] [transform-style:preserve-3d] sm:text-8xl lg:text-[8.5rem]"
            >
              {WORD.split("").map((ch, i) => (
                <span
                  key={i}
                  data-letter
                  aria-hidden
                  className="inline-block will-change-transform"
                >
                  {ch}
                </span>
              ))}
              <span data-period aria-hidden className="inline-block text-accent">
                .
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Flat overlay: chrome that should stay crisp and screen-aligned. */}
      <div className="pointer-events-none absolute left-6 top-6 font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
        A photo journal
      </div>
      <div className="pointer-events-none absolute right-6 top-6 font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
        Leafed by machine
      </div>

      {/* Outro: tagline + search, surfacing as the wordmark clears. */}
      <div
        ref={outroRef}
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center opacity-0"
      >
        {children}
      </div>

      <div
        ref={hintRef}
        className="pointer-events-none absolute inset-x-0 bottom-7 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500"
      >
        Scroll to leaf through ↓
      </div>
      <div className="pointer-events-none absolute bottom-7 right-6 font-mono text-[10px] tracking-[0.3em] text-zinc-400">
        <span ref={counterRef}>000</span> / 100
      </div>
    </section>
  );
}
