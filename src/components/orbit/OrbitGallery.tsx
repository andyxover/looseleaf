"use client";

// Immersive "orbit" view: the visitor stands at the center of a sphere whose
// inner surface is tiled with entry cards. Drag (or wheel) to look around with
// inertial easing; click a card to fly into its journal page.
//
// Three.js renders the sphere; gsap drives the fly-in transition. All motion
// runs through a damped-lerp loop so dragging has the same eased, weighty feel
// as the Lenis scroll on the classic view.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import gsap from "gsap";

import type { FeedEntry } from "@/lib/feed";

type OrbitGalleryProps = {
  entries: FeedEntry[];
  onExit?: () => void;
};

const RADIUS = 14; // sphere radius the cards sit on
const CARD_W = 3.6;
const CARD_H = 2.5;
const ROWS = 3; // latitude bands, like a gallery wrapped around you
const ROW_PHI = [0.42, 0, -0.42]; // band elevations (radians above/below equator)
const DRAG_EASE = 0.075; // lerp factor toward target rotation per frame
const MOMENTUM_DECAY = 0.94;
const PITCH_LIMIT = 0.75; // don't let the visitor stare at the poles
const CLICK_SLOP_PX = 7; // pointer travel below this counts as a click

// Resolve a cover (Cloudinary public_id or local "/uploads/..." path) to a
// loadable URL. Cloudinary serves CORS-friendly, auto-format crops.
function coverUrl(cover: string): string {
  if (cover.startsWith("/")) return cover;
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_640,h_440,g_auto,q_auto,f_auto/${cover}`;
}

function dateLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

// Tiny mono caption drawn onto a canvas texture, shown beneath each card.
function makeCaptionTexture(title: string, date: string): THREE.CanvasTexture {
  const w = 640;
  const h = 56;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "500 22px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(246, 242, 234, 0.92)"; // paper, on the dark backdrop
  let t = title.toUpperCase();
  while (t.length > 3 && ctx.measureText(t + "…").width > w - 190) t = t.slice(0, -1);
  if (t !== title.toUpperCase()) t += "…";
  ctx.fillText(t, 4, h / 2);
  ctx.fillStyle = "rgba(246, 242, 234, 0.45)";
  ctx.textAlign = "right";
  ctx.fillText(date, w - 4, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

export function OrbitGallery({ entries, onExit }: OrbitGalleryProps) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<FeedEntry | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const hoveredIdRef = useRef<string | null>(null);
  const departingRef = useRef(false);

  // Lock page scroll while immersed. Restore to the stylesheet default rather
  // than the captured value — anything else that toggled body overflow (e.g.
  // the dev error overlay) would otherwise leak its lock into the feed.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const cards = entries.filter((e) => e.cover);
    if (cards.length === 0) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- Scene scaffolding -------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0a09"); // paper-dark
    scene.fog = new THREE.FogExp2(0x0c0a09, 0.028); // cards dim toward the edges

    const camera = new THREE.PerspectiveCamera(
      62,
      mount.clientWidth / mount.clientHeight,
      0.1,
      80,
    );
    camera.rotation.order = "YXZ"; // yaw then pitch, like a head turning

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    // --- Cards on the inner sphere ----------------------------------------
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const cardGroup = new THREE.Group();
    scene.add(cardGroup);
    const cardMeshes: THREE.Mesh[] = [];
    const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    const captionGeo = new THREE.PlaneGeometry(CARD_W, (CARD_W * 56) / 640);
    const disposables: { dispose(): void }[] = [cardGeo, captionGeo];

    const perRow = Math.ceil(cards.length / ROWS);
    cards.forEach((entry, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inRow = Math.min(perRow, cards.length - row * perRow);
      // Even ring spacing with a touch of jitter, alternate rows offset half a
      // step so the grid reads as a brick-like wall rather than columns.
      const theta =
        (col / inRow) * Math.PI * 2 +
        (row % 2 ? Math.PI / inRow : 0) +
        (((i * 37) % 10) - 5) * 0.006;
      const phi = ROW_PHI[row % ROWS] + (((i * 53) % 10) - 5) * 0.008;
      const r = RADIUS + (((i * 29) % 10) - 5) * 0.06;

      const pos = new THREE.Vector3(
        r * Math.cos(phi) * Math.sin(theta),
        r * Math.sin(phi),
        r * Math.cos(phi) * Math.cos(theta),
      );

      const mat = new THREE.MeshBasicMaterial({
        color: 0x1c1917, // placeholder slab until the photo arrives
        transparent: true,
        opacity: 0,
        fog: true,
      });
      disposables.push(mat);
      const mesh = new THREE.Mesh(cardGeo, mat);
      mesh.position.copy(pos);
      mesh.lookAt(0, 0, 0);
      mesh.userData = { entry, baseScale: 1 };
      cardGroup.add(mesh);
      cardMeshes.push(mesh);

      // Caption strip below the photo.
      const capTex = makeCaptionTexture(entry.title, dateLabel(entry.date));
      const capMat = new THREE.MeshBasicMaterial({
        map: capTex,
        transparent: true,
        opacity: 0,
        fog: true,
      });
      disposables.push(capTex, capMat);
      const cap = new THREE.Mesh(captionGeo, capMat);
      // Place in the card's local space: lookAt already oriented the card, so
      // attach the caption as a child sitting just below.
      cap.position.set(0, -(CARD_H / 2 + 0.32), 0);
      mesh.add(cap);

      // Photos pop in as they decode — staggered by distance from the start.
      loader.load(coverUrl(entry.cover!), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        disposables.push(tex);
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        gsap.to(mat, { opacity: 1, duration: 0.9, ease: "power2.out", delay: (i % 12) * 0.05 });
        gsap.to(capMat, { opacity: 1, duration: 0.9, ease: "power2.out", delay: (i % 12) * 0.05 + 0.15 });
      });
    });

    // --- Rotation state: damped lerp toward a target, momentum on release --
    const rot = { yaw: 0, pitch: 0 };
    const target = { yaw: 0, pitch: 0 };
    const velocity = { yaw: 0, pitch: 0 };
    let dragging = false;
    let interacted = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;

    // Gentle welcome: drift in from the side so the space reads as 3D at once.
    if (!prefersReduced) {
      rot.yaw = -0.55;
      gsap.to(rot, { yaw: 0, duration: 1.8, ease: "power3.out" });
    }

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function pick(clientX: number, clientY: number): THREE.Mesh | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(cardMeshes, false)[0];
      return (hit?.object as THREE.Mesh) ?? null;
    }

    function setHover(mesh: THREE.Mesh | null) {
      const id = mesh ? (mesh.userData.entry as FeedEntry).id : null;
      if (id === hoveredIdRef.current) return;
      hoveredIdRef.current = id;
      for (const m of cardMeshes) {
        const isTarget = m === mesh;
        gsap.to(m.scale, {
          x: isTarget ? 1.09 : 1,
          y: isTarget ? 1.09 : 1,
          z: 1,
          duration: 0.45,
          ease: "power3.out",
        });
      }
      renderer.domElement.style.cursor = mesh ? "pointer" : dragging ? "grabbing" : "grab";
      const entry = mesh ? (mesh.userData.entry as FeedEntry) : null;
      setHovered(entry);
      if (entry) router.prefetch(`/journal/${entry.id}`);
    }

    // --- Fly into a card, then navigate ------------------------------------
    function departTo(mesh: THREE.Mesh) {
      if (departingRef.current) return;
      departingRef.current = true;
      const entry = mesh.userData.entry as FeedEntry;
      const dir = mesh.position.clone().normalize();

      // Yaw/pitch that point the camera straight at the card (YXZ camera at
      // origin faces (-sin yaw, sin pitch, -cos yaw)), unwrapped to the
      // nearest turn so the camera takes the short way around.
      let aimYaw = Math.atan2(-dir.x, -dir.z);
      aimYaw += Math.round((rot.yaw - aimYaw) / (Math.PI * 2)) * Math.PI * 2;
      const aimPitch = Math.asin(dir.y);

      velocity.yaw = 0;
      velocity.pitch = 0;
      const dest = dir.multiplyScalar(RADIUS - 4.2);
      const tl = gsap.timeline({
        onComplete: () => router.push(`/journal/${entry.id}`),
      });
      tl.to(rot, { yaw: aimYaw, pitch: aimPitch, duration: 0.7, ease: "power3.inOut" }, 0)
        .to(target, { yaw: aimYaw, pitch: aimPitch, duration: 0.7, ease: "power3.inOut" }, 0)
        .to(camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.95, ease: "power3.in" }, 0.1)
        .to(camera, { fov: 44, duration: 0.95, ease: "power3.in", onUpdate: () => camera.updateProjectionMatrix() }, 0.1)
        .to(overlayRef.current, { opacity: 1, duration: 0.45, ease: "power2.in" }, 0.62);
    }

    // --- Pointer + wheel ----------------------------------------------------
    const el = renderer.domElement;

    function onPointerDown(e: PointerEvent) {
      if (departingRef.current) return;
      dragging = true;
      interacted = true;
      setHintDismissed(true);
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
      velocity.yaw = 0;
      velocity.pitch = 0;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    }

    function onPointerMove(e: PointerEvent) {
      if (departingRef.current) return;
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        // Inside a sphere, dragging right should pull the world right — i.e.
        // yaw the camera left — which matches "grab the wall and drag it".
        const k = 0.0028;
        target.yaw += dx * k;
        target.pitch += dy * k;
        target.pitch = THREE.MathUtils.clamp(target.pitch, -PITCH_LIMIT, PITCH_LIMIT);
        velocity.yaw = dx * k;
        velocity.pitch = dy * k;
      } else {
        setHover(pick(e.clientX, e.clientY));
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      const travel = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (travel < CLICK_SLOP_PX && !departingRef.current) {
        const mesh = pick(e.clientX, e.clientY);
        if (mesh) departTo(mesh);
      }
    }

    function onWheel(e: WheelEvent) {
      if (departingRef.current) return;
      e.preventDefault();
      interacted = true;
      setHintDismissed(true);
      // Wheel spins the gallery horizontally — vertical scroll is the natural
      // gesture, so map it onto yaw; shift/trackpad horizontal adds too.
      target.yaw += (e.deltaY + e.deltaX) * 0.00045;
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !departingRef.current) onExit?.();
    }
    window.addEventListener("keydown", onKey);

    function onResize() {
      camera.aspect = mount!.clientWidth / mount!.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount!.clientWidth, mount!.clientHeight);
    }
    window.addEventListener("resize", onResize);

    // --- Frame loop ---------------------------------------------------------
    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);

      if (!dragging && !departingRef.current) {
        // Momentum: keep pushing the target with decaying release velocity.
        if (Math.abs(velocity.yaw) > 0.00002 || Math.abs(velocity.pitch) > 0.00002) {
          target.yaw += velocity.yaw;
          target.pitch = THREE.MathUtils.clamp(
            target.pitch + velocity.pitch,
            -PITCH_LIMIT,
            PITCH_LIMIT,
          );
          velocity.yaw *= MOMENTUM_DECAY;
          velocity.pitch *= MOMENTUM_DECAY;
        }
        // Idle drift until the first interaction, so the space feels alive.
        if (!interacted && !prefersReduced) target.yaw += 0.00045;
      }

      if (!departingRef.current) {
        rot.yaw += (target.yaw - rot.yaw) * DRAG_EASE;
        rot.pitch += (target.pitch - rot.pitch) * DRAG_EASE;
      }
      camera.rotation.y = rot.yaw;
      camera.rotation.x = rot.pitch;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      gsap.killTweensOf([rot, target, camera, camera.position]);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // The gallery is rebuilt only when the entry set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    <div className="fixed inset-0 z-40 bg-[#0c0a09]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Soft vignette so the edges fall away like a darkened room. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Hint — fades once the visitor starts exploring. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-8 text-center transition-opacity duration-700 ${
          hintDismissed ? "opacity-0" : "opacity-100"
        }`}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-400">
          Drag to look around — click a moment to read it
        </p>
      </div>

      {/* HUD caption for the hovered card. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 text-center sm:bottom-10">
        <div
          className={`inline-block transition-all duration-300 ${
            hovered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <p className="font-serif text-2xl tracking-tight text-paper sm:text-3xl">
            {hovered?.title}
          </p>
          {hovered && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400">
              {dateLabel(hovered.date)} · {hovered.photoCount}{" "}
              {hovered.photoCount === 1 ? "photo" : "photos"}
            </p>
          )}
        </div>
      </div>

      {/* Wordmark, quietly anchoring the corner. */}
      <div className="pointer-events-none absolute left-6 top-7 font-mono text-xs uppercase tracking-[0.3em] text-zinc-300">
        Looseleaf
      </div>

      {/* Fly-in fade — gsap drives opacity, then we navigate. */}
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 bg-paper opacity-0 dark:bg-paper-dark"
      />
    </div>
  );
}
