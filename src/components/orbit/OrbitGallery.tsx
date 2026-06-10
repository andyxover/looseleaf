"use client";

// Immersive "orbit" view: the visitor stands at the center of a sphere whose
// inner surface is a contiguous grid of entry cells — thin hairline borders,
// metadata in the corners, the photo floating in the middle of each cell.
// Drag (or wheel) to look around with inertial easing. Cells sit dimmed until
// hovered, when they light up. Clicking flies the camera into the cell and
// hands off to a DOM clone of the photo that expands to fill the screen while
// the journal route loads beneath it — one continuous, directional move.
//
// Three.js renders the wall; gsap drives every transition. All rotation runs
// through a damped-lerp loop so dragging has the same eased, weighty feel as
// the Lenis scroll on the classic view.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import gsap from "gsap";

import type { FeedEntry } from "@/lib/feed";

type OrbitGalleryProps = {
  entries: FeedEntry[];
  onExit?: () => void;
};

const RADIUS = 14; // sphere radius the cell lattice sits on
const COLS = 18; // cells per full 360° ring — small angles keep cells near-flat
const MAX_ROWS = 4;
const CELL_PHI = (Math.PI * 2) / COLS; // azimuthal width of a cell (20°)
const CELL_THETA = 0.25; // polar height of a cell — landscape ratio (~1.4)
const PHOTO_FRACTION = 0.58; // photo patch size relative to its cell
const DRAG_EASE = 0.075; // lerp factor toward target rotation per frame
const MOMENTUM_DECAY = 0.94;
const CLICK_SLOP_PX = 7; // pointer travel below this counts as a click
const DIM = 0.62; // resting photo brightness; hover lifts to 1

// Resolve a cover (Cloudinary public_id or local "/uploads/..." path) to a
// loadable URL. Cloudinary serves CORS-friendly, auto-format crops.
function coverUrl(cover: string, w: number, h: number): string {
  if (cover.startsWith("/")) return cover;
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_${w},h_${h},g_auto,q_auto,f_auto/${cover}`;
}

function dateLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

// Bake one cell's chrome — hairline border plus corner metadata, phantom-style:
// date top-left, title top-right, tag chips bottom-left, year bottom-right.
function makeCellTexture(entry: FeedEntry): THREE.CanvasTexture {
  const W = 1024;
  const H = 731; // matches the cell patch's arc aspect (~1.4)
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const mono = "500 21px 'JetBrains Mono', ui-monospace, monospace";
  const ink = "rgba(246, 242, 234, 0.85)";
  const faint = "rgba(246, 242, 234, 0.4)";
  const pad = 26;

  // Cell ground — a hair lighter than the room, so the lattice reads as panels.
  ctx.fillStyle = "#100e0d";
  ctx.fillRect(0, 0, W, H);
  // Hairline border = the shared grid lines of the lattice.
  ctx.strokeStyle = "rgba(246, 242, 234, 0.13)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  ctx.font = mono;
  ctx.textBaseline = "top";

  // Top-left: entry date (the "client" slot in the reference layout).
  ctx.fillStyle = faint;
  const date = dateLabel(entry.date);
  ctx.fillText(date, pad, pad);

  // Top-right: title, truncated to the space the date leaves free.
  ctx.fillStyle = ink;
  const maxTitle = W - pad * 3 - ctx.measureText(date).width;
  let t = entry.title.toUpperCase();
  while (t.length > 3 && ctx.measureText(t + "…").width > maxTitle) t = t.slice(0, -1);
  if (t !== entry.title.toUpperCase()) t += "…";
  ctx.textAlign = "right";
  ctx.fillText(t, W - pad, pad);
  ctx.textAlign = "left";

  // Bottom-left: tag chips.
  const chips = ["JOURNAL", `${entry.photoCount} ${entry.photoCount === 1 ? "PHOTO" : "PHOTOS"}`];
  const chipH = 44;
  const chipY = H - pad - chipH;
  let x = pad;
  ctx.textBaseline = "middle";
  for (const chip of chips) {
    const tw = ctx.measureText(chip).width;
    const cw = tw + 36;
    ctx.strokeStyle = "rgba(246, 242, 234, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, chipY, cw, chipH, chipH / 2);
    ctx.stroke();
    ctx.fillStyle = faint;
    ctx.fillText(chip, x + 18, chipY + chipH / 2 + 1);
    x += cw + 12;
  }

  // Bottom-right: year.
  ctx.fillStyle = faint;
  ctx.textAlign = "right";
  ctx.fillText(entry.date.slice(0, 4), W - pad, chipY + chipH / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; // canvas pixels are sRGB, not linear
  tex.anisotropy = 8;
  // Viewed from inside the sphere the patch is seen from its back face, which
  // mirrors the texture — flip U so the type reads correctly.
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -1;
  return tex;
}

// A curved rectangular patch of the sphere's inner surface.
function patchGeometry(
  radius: number,
  phiCenter: number,
  phiLength: number,
  polarCenter: number,
  thetaLength: number,
): THREE.SphereGeometry {
  return new THREE.SphereGeometry(
    radius,
    10,
    8,
    phiCenter - phiLength / 2,
    phiLength,
    polarCenter - thetaLength / 2,
    thetaLength,
  );
}

export function OrbitGallery({ entries, onExit }: OrbitGalleryProps) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
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
    const withCovers = entries.filter((e) => e.cover);
    if (withCovers.length === 0) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Drive gsap from our render loop instead of its own ticker, so tween
    // updates and frames are always in lockstep — gsap's internal ticker
    // stalls in hidden/headless tabs while ours still pumps on capture.
    gsap.ticker.remove(gsap.updateRoot);
    gsap.ticker.lagSmoothing(0);

    // --- Scene scaffolding -------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0a09"); // paper-dark
    scene.fog = new THREE.FogExp2(0x0c0a09, 0.02); // panels dim toward the edges

    const camera = new THREE.PerspectiveCamera(
      55, // modest FOV — wide angles fisheye the lattice into a barrel
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

    // --- The cell lattice ---------------------------------------------------
    // Fill every cell of the grid; if there are fewer entries than cells,
    // cycle from the start so the wall has no holes.
    const rows = Math.min(MAX_ROWS, Math.max(1, Math.ceil(withCovers.length / COLS)));
    const cellCount = rows * COLS;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const disposables: { dispose(): void }[] = [];
    type Cell = {
      entry: FeedEntry;
      cellMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
      photoMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
      phiCenter: number;
      polarCenter: number;
    };
    const cells: Cell[] = [];
    const pickables: THREE.Mesh[] = [];

    for (let i = 0; i < cellCount; i++) {
      const entry = withCovers[i % withCovers.length];
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const phiCenter = col * CELL_PHI;
      // Center the rows on the equator (polar angle π/2).
      const polarCenter = Math.PI / 2 + (row - (rows - 1) / 2) * CELL_THETA;

      const cellGeo = patchGeometry(RADIUS, phiCenter, CELL_PHI, polarCenter, CELL_THETA);
      const cellTex = makeCellTexture(entry);
      const cellMat = new THREE.MeshBasicMaterial({
        map: cellTex,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0,
        fog: true,
      });
      const cellMesh = new THREE.Mesh(cellGeo, cellMat);
      disposables.push(cellGeo, cellTex, cellMat);

      // The photo floats in the middle of the cell, a hair inside the lattice.
      const photoGeo = patchGeometry(
        RADIUS * 0.985,
        phiCenter,
        CELL_PHI * PHOTO_FRACTION,
        polarCenter,
        CELL_THETA * PHOTO_FRACTION,
      );
      const photoMat = new THREE.MeshBasicMaterial({
        color: 0x181614, // placeholder slab until the photo arrives
        side: THREE.BackSide,
        transparent: true,
        opacity: 0,
        fog: true,
      });
      const photoMesh = new THREE.Mesh(photoGeo, photoMat);
      disposables.push(photoGeo, photoMat);

      const cell: Cell = { entry, cellMesh, photoMesh, phiCenter, polarCenter };
      cellMesh.userData.cell = cell;
      photoMesh.userData.cell = cell;
      scene.add(cellMesh, photoMesh);
      pickables.push(photoMesh, cellMesh);
      cells.push(cell);

      gsap.to(cellMat, { opacity: 1, duration: 0.8, ease: "power2.out", delay: (i % COLS) * 0.04 });

      loader.load(coverUrl(entry.cover!, 640, 460), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1; // same back-face mirror fix as the cell chrome
        disposables.push(tex);
        photoMat.map = tex;
        photoMat.color.setScalar(DIM); // resting state is dimmed; hover lights up
        photoMat.needsUpdate = true;
        gsap.to(photoMat, {
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
          delay: (i % COLS) * 0.04 + 0.1,
        });
      });
    }

    // --- Rotation state: damped lerp toward a target, momentum on release --
    const pitchLimit = (rows / 2) * CELL_THETA + 0.12;
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

    function pick(clientX: number, clientY: number): Cell | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return (hit?.object.userData.cell as Cell) ?? null;
    }

    function setHover(cell: Cell | null) {
      const id = cell ? cell.entry.id : null;
      if (id === hoveredIdRef.current) return;
      hoveredIdRef.current = id;
      // Light the hovered cell up; everything else settles back to rest.
      for (const c of cells) {
        const on = c === cell || (cell !== null && c.entry.id === cell.entry.id);
        if (c.photoMesh.material.map) {
          const tint = { v: c.photoMesh.material.color.r };
          gsap.to(tint, {
            v: on ? 1 : DIM,
            duration: 0.4,
            ease: "power2.out",
            onUpdate: () => c.photoMesh.material.color.setScalar(tint.v),
          });
        }
        // Brightening a >1 multiply lifts the baked border + type.
        const cellTint = { v: c.cellMesh.material.color.r };
        gsap.to(cellTint, {
          v: on ? 1.9 : 1,
          duration: 0.4,
          ease: "power2.out",
          onUpdate: () => c.cellMesh.material.color.setScalar(cellTint.v),
        });
        // Scaling toward the origin pulls the photo a touch closer — a lift.
        gsap.to(c.photoMesh.scale, {
          x: on ? 0.965 : 1,
          y: on ? 0.965 : 1,
          z: on ? 0.965 : 1,
          duration: 0.45,
          ease: "power3.out",
        });
      }
      renderer.domElement.style.cursor = cell ? "pointer" : dragging ? "grabbing" : "grab";
      setHovered(cell ? cell.entry : null);
      if (cell) {
        router.prefetch(`/journal/${cell.entry.id}`);
        // Warm the full-size image the handoff overlay will use.
        new Image().src = coverUrl(cell.entry.cover!, 1600, 1200);
      }
    }

    // Project a mesh's bounding box to a screen-space rect (CSS pixels).
    function screenRect(mesh: THREE.Mesh): { x: number; y: number; w: number; h: number } {
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      const pts = [
        new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
        new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
        new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
        new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
        new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
        new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
        new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
        new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
      ];
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        mesh.localToWorld(p).project(camera);
        const sx = ((p.x + 1) / 2) * w;
        const sy = ((1 - p.y) / 2) * h;
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx);
        maxY = Math.max(maxY, sy);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    // DOM handoff: a clone of the photo, appended straight to document.body so
    // it survives the route change, expands from the card's projected rect to
    // fullscreen, then fades to reveal the journal page underneath.
    function spawnHandoff(cell: Cell) {
      const rect = screenRect(cell.photoMesh);
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
      const scrim = document.createElement("div");
      scrim.style.cssText = "position:absolute;inset:0;background:#0c0a09;opacity:0;";
      const img = document.createElement("img");
      img.src = coverUrl(cell.entry.cover!, 1600, 1200);
      img.alt = "";
      img.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px;object-fit:cover;`;
      wrap.append(scrim, img);
      document.body.appendChild(wrap);

      gsap.to(scrim, { opacity: 1, duration: 0.7, ease: "power2.inOut" });
      // The clone rides the same easing as the camera dolly behind it, so the
      // DOM and WebGL motion read as one continuous move into the page.
      gsap.to(img, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        duration: 1.05,
        ease: "power3.inOut",
      });
      // Hold over the incoming page for a beat, then dissolve into it. This
      // closure outlives the component — the wall unmounts mid-handoff.
      gsap.to(wrap, {
        opacity: 0,
        duration: 0.7,
        delay: 1.7,
        ease: "power2.inOut",
        onComplete: () => wrap.remove(),
      });
    }

    // --- Fly into a cell, hand off, navigate --------------------------------
    function departTo(cell: Cell) {
      if (departingRef.current) return;
      departingRef.current = true;
      setHovered(null);
      const dir = new THREE.Vector3();
      cell.photoMesh.geometry.computeBoundingBox();
      cell.photoMesh.geometry.boundingBox!.getCenter(dir).normalize();

      // Yaw/pitch that point the camera straight at the cell (YXZ camera at
      // origin faces (-sin yaw, sin pitch, -cos yaw)), unwrapped to the
      // nearest turn so the camera takes the short way around.
      let aimYaw = Math.atan2(-dir.x, -dir.z);
      aimYaw += Math.round((rot.yaw - aimYaw) / (Math.PI * 2)) * Math.PI * 2;
      const aimPitch = Math.asin(dir.y);

      velocity.yaw = 0;
      velocity.pitch = 0;

      // Spawn the DOM clone right away, while every corner of the card still
      // projects cleanly — it owns the visible move from here, expanding from
      // the card's exact screen position to fullscreen.
      spawnHandoff(cell);

      if (prefersReduced) {
        gsap.delayedCall(0.55, () => router.push(`/journal/${cell.entry.id}`));
        return;
      }

      // The camera keeps flying behind the clone so the first beats of the
      // move (before the clone covers the frame) stay directional.
      const dest = dir.clone().multiplyScalar(RADIUS * 0.985 - 2.2);
      const tl = gsap.timeline();
      tl.to(rot, { yaw: aimYaw, pitch: aimPitch, duration: 0.65, ease: "power3.inOut" }, 0)
        .to(target, { yaw: aimYaw, pitch: aimPitch, duration: 0.65, ease: "power3.inOut" }, 0)
        .to(
          camera.position,
          { x: dest.x, y: dest.y, z: dest.z, duration: 1.0, ease: "power3.inOut" },
          0.05,
        )
        .call(() => router.push(`/journal/${cell.entry.id}`), [], 1.1);
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
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // synthetic events have no active pointer to capture
      }
      el.style.cursor = "grabbing";
    }

    function onPointerMove(e: PointerEvent) {
      if (departingRef.current) return;
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        // Inside a sphere, dragging right pulls the wall right — i.e. yaws the
        // camera left — which matches "grab the wall and drag it".
        const k = 0.0028;
        target.yaw += dx * k;
        target.pitch += dy * k;
        target.pitch = THREE.MathUtils.clamp(target.pitch, -pitchLimit, pitchLimit);
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
        const cell = pick(e.clientX, e.clientY);
        if (cell) departTo(cell);
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

    if (process.env.NODE_ENV !== "production") {
      // Live inspection hook for debugging the wall from the console.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__orbitDebug = { scene, camera, cells, renderer, gsap };
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

    // Observe the container rather than the window — it catches sizes that
    // settle around mount time (lazy chunk load, viewport emulation) that a
    // window resize listener can miss.
    const resizeObserver = new ResizeObserver(() => {
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // --- Frame loop ---------------------------------------------------------
    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      gsap.updateRoot(performance.now() / 1000);

      if (!dragging && !departingRef.current) {
        // Momentum: keep pushing the target with decaying release velocity.
        if (Math.abs(velocity.yaw) > 0.00002 || Math.abs(velocity.pitch) > 0.00002) {
          target.yaw += velocity.yaw;
          target.pitch = THREE.MathUtils.clamp(
            target.pitch + velocity.pitch,
            -pitchLimit,
            pitchLimit,
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
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      gsap.killTweensOf([rot, target, camera.position]);
      // Hand the clock back to gsap's own ticker — the post-navigation
      // handoff overlay tweens keep running after this component is gone.
      gsap.ticker.add(gsap.updateRoot);
      gsap.ticker.lagSmoothing(500, 33);
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

      {/* HUD caption for the hovered cell. */}
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
    </div>
  );
}
