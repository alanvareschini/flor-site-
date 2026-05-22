"use client";

import { useEffect, useRef, useState } from "react";

// ─── CONFIG ─────────────────────────────────────────────────────
const PROGRESS_COUNT = 9;
const BURST_COUNT    = 36;
const PHASE1_MS      = 1450;
const TOTAL_MS       = 2400;

// ─── PETAL PATHS ────────────────────────────────────────────────
// Two realistic cherry blossom petal shapes (tip=top notch, base=bottom)
// ViewBox: -22 -22 44 44
const PETAL_PATHS = [
  // Variant A – elongated, prominent notch
  "M-3,-17 C-8,-22 -16,-15 -15,-6 C-14,3 -9,12 -5,18 C-2,20 0,21 0,21 C0,21 2,20 5,18 C9,12 14,3 15,-6 C16,-15 8,-22 3,-17 C2,-14 0,-13 0,-13 C0,-13 -2,-14 -3,-17 Z",
  // Variant B – rounder, wider, subtle notch
  "M-2,-18 C-5,-22 -15,-16 -15,-7 C-15,2 -10,12 -4,17 C-2,20 0,21 0,21 C0,21 2,20 4,17 C10,12 15,2 15,-7 C15,-16 5,-22 2,-18 C1,-15 0,-14 0,-14 C0,-14 -1,-15 -2,-18 Z",
];

// ─── COLOUR PALETTE ─────────────────────────────────────────────
// [gradient-center(base), gradient-mid, gradient-edge(tip)]
const PETAL_COLORS: [string, string, string][] = [
  ["rgba(215,120,155,0.94)", "rgba(245,178,202,0.86)", "rgba(255,226,239,0.50)"],
  ["rgba(228,138,168,0.92)", "rgba(250,190,212,0.84)", "rgba(255,232,243,0.47)"],
  ["rgba(200,108,142,0.96)", "rgba(236,165,190,0.88)", "rgba(255,218,232,0.54)"],
  ["rgba(235,148,178,0.90)", "rgba(252,196,217,0.82)", "rgba(255,236,245,0.45)"],
  ["rgba(218,130,162,0.93)", "rgba(246,184,207,0.85)", "rgba(255,228,240,0.50)"],
];

// ─── SVG BUILDER ────────────────────────────────────────────────
let _uid = 0;
function petalSVG(size: number, colorIdx: number, pathIdx: number, rotateDeg: number): string {
  const id   = `pk${++_uid}`;
  const [c0, c1, c2] = PETAL_COLORS[colorIdx % PETAL_COLORS.length];
  const path = PETAL_PATHS[pathIdx  % PETAL_PATHS.length];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-22 -22 44 44">` +
    `<defs>` +
    `<radialGradient id="${id}" cx="0" cy="16" r="36" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%" stop-color="${c0}"/>` +
    `<stop offset="42%" stop-color="${c1}"/>` +
    `<stop offset="100%" stop-color="${c2}"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<g transform="rotate(${rotateDeg})">` +
    `<path d="${path}" fill="url(#${id})" stroke="rgba(185,100,135,0.18)" stroke-width="0.45"/>` +
    `<line x1="0" y1="-16" x2="0" y2="19" stroke="rgba(185,100,135,0.20)" stroke-width="0.5" stroke-linecap="round"/>` +
    `<path d="M0,-5 Q-7,4 -9,16" fill="none" stroke="rgba(185,100,135,0.14)" stroke-width="0.35" stroke-linecap="round"/>` +
    `<path d="M0,-5 Q7,4 9,16" fill="none" stroke="rgba(185,100,135,0.14)" stroke-width="0.35" stroke-linecap="round"/>` +
    `</g>` +
    `</svg>`
  );
}

function toDataURL(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const rnd    = (a: number, b: number) => a + Math.random() * (b - a);
const rndInt = (a: number, b: number) => Math.floor(rnd(a, b + 1));

function done(loader: HTMLElement, setMounted: (v: boolean) => void) {
  if ((loader as HTMLElement & { _d?: boolean })._d) return;
  (loader as HTMLElement & { _d?: boolean })._d = true;
  document.body.classList.remove("is-loading");
  document.body.classList.add("site-ready");
  setMounted(false);
}

// ─── COMPONENT ──────────────────────────────────────────────────
export function SakuraLoader() {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.classList.add("is-loading");
    const loader = ref.current;
    if (!loader) return;

    if (reduced) {
      setTimeout(() => {
        loader.style.transition = "opacity 0.5s ease";
        loader.style.opacity = "0";
        setTimeout(() => done(loader, setMounted), 550);
      }, TOTAL_MS);
      return;
    }

    const progressEl = loader.querySelector(".skl-progress") as HTMLElement;
    const burstEl    = loader.querySelector(".skl-burst")    as HTMLElement;
    const petalEls: HTMLElement[] = [];

    // ── Build progress petals ────────────────────────────────
    for (let i = 0; i < PROGRESS_COUNT; i++) {
      const size     = rnd(22, 30);
      const rot      = rnd(-22, 22);
      const colorIdx = i % PETAL_COLORS.length;
      const pathIdx  = i % PETAL_PATHS.length;
      const swayDur  = rnd(2.8, 4.2).toFixed(2);
      const swayDel  = rnd(0, 1.8).toFixed(2);

      const div = document.createElement("div");
      div.style.cssText = [
        `width:${size}px`,
        `height:${size}px`,
        `opacity:0`,
        `transform:translateY(10px) scale(0.5)`,
        `transition:opacity 0.45s ease,transform 0.55s cubic-bezier(0.34,1.56,0.64,1)`,
        `will-change:transform,opacity`,
        `flex-shrink:0`,
        `display:flex`,
        `align-items:center`,
        `justify-content:center`,
      ].join(";");

      const img = new Image(size, size);
      img.src = toDataURL(petalSVG(size, colorIdx, pathIdx, rot));
      img.style.cssText = [
        `display:block`,
        `animation:skl-sway ${swayDur}s ease-in-out infinite ${swayDel}s`,
        `will-change:transform`,
      ].join(";");

      div.appendChild(img);
      progressEl.appendChild(div);
      petalEls.push(div);
    }

    // ── Stagger reveal left → right ──────────────────────────
    const step = (PHASE1_MS - 700) / PROGRESS_COUNT;
    petalEls.forEach((el, i) => {
      setTimeout(() => {
        el.style.opacity   = "1";
        el.style.transform = "translateY(0) scale(1)";
      }, 350 + i * step);
    });

    // ── Phase 2: explosion ───────────────────────────────────
    const timer = setTimeout(() => {
      const vw   = window.innerWidth;
      const vh   = window.innerHeight;
      const rect = progressEl.getBoundingClientRect();
      const ox   = rect.left + rect.width  / 2;
      const oy   = rect.top  + rect.height / 2;

      // Stop ambient particle animation to free compositor
      const particlesEl = loader.querySelector(".skl-particles") as HTMLElement | null;
      if (particlesEl) particlesEl.style.animation = "none";

      // Fly progress petals away
      petalEls.forEach((el) => {
        const tx  = rnd(-vw * 0.55, vw * 0.55);
        const ty  = rnd(-vh * 0.65, vh * 0.35);
        const sc  = rnd(0.4, 2.8);
        const rot = rnd(-540, 540);
        const dur = rnd(750, 1300);
        const bl  = sc > 2 ? rnd(1.5, 5) : 0;
        el.style.transition =
          `transform ${dur}ms cubic-bezier(0.1,0.82,0.3,1),` +
          `opacity ${dur * 0.5}ms ease ${dur * 0.4}ms` +
          (bl ? `,filter ${dur}ms ease` : "");
        el.style.transform = `translate(${tx}px,${ty}px) scale(${sc}) rotate(${rot}deg)`;
        el.style.opacity   = "0";
        if (bl) el.style.filter = `blur(${bl}px)`;
      });

      // Pre-generate all burst petal data URLs off the critical path
      type BurstData = {
        size: number; rot0: number; tx: number; ty: number;
        sc: number; rot1: number; dur: number; del: number;
        bl: number; src: string;
      };
      const burstData: BurstData[] = [];
      for (let i = 0; i < BURST_COUNT; i++) {
        const size     = rnd(10, 48);
        const pathIdx  = rndInt(0, 1);
        const colorIdx = rndInt(0, PETAL_COLORS.length - 1);
        const rot0     = rnd(0, 360);
        burstData.push({
          size, rot0,
          tx:   rnd(-vw * 0.65, vw * 0.65),
          ty:   rnd(-vh * 0.72, vh * 0.48),
          sc:   rnd(0.3, 3.8),
          rot1: rnd(-720, 720),
          dur:  rnd(650, 1500),
          del:  rnd(0, 290),
          bl:   rnd(0.3, 3.8) > 2.8 ? rnd(2, 8) : rnd(0.3, 3.8) > 1.8 ? rnd(0, 2.5) : 0,
          src:  toDataURL(petalSVG(size, colorIdx, pathIdx, rot0)),
        });
      }

      // Spawn burst petals via rAF stagger — keeps main thread free
      let burstIdx = 0;
      const BATCH = 10; // elements per frame
      const spawnBatch = () => {
        const end = Math.min(burstIdx + BATCH, burstData.length);
        for (; burstIdx < end; burstIdx++) {
          const d = burstData[burstIdx];
          const el = document.createElement("div");
          el.style.cssText = [
            `position:absolute`,
            `top:${oy}px`,
            `left:${ox}px`,
            `width:${d.size}px`,
            `height:${d.size}px`,
            `margin:${-d.size / 2}px 0 0 ${-d.size / 2}px`,
            `transform:rotate(${d.rot0}deg) scale(0.9)`,
            `opacity:0.88`,
            `will-change:transform,opacity`,
            `pointer-events:none`,
          ].join(";");
          const img = new Image(d.size, d.size);
          img.src = d.src;
          img.style.display = "block";
          el.appendChild(img);
          burstEl.appendChild(el);
          // trigger animation on next rAF so browser has painted the initial state
          requestAnimationFrame(() => {
            const t =
              `transform ${d.dur}ms cubic-bezier(0.1,0.85,0.3,1) ${d.del}ms,` +
              `opacity ${d.dur * 0.55}ms ease ${d.del + d.dur * 0.42}ms`;
            el.style.transition = d.bl ? `${t},filter ${d.dur}ms ease ${d.del}ms` : t;
            el.style.transform  = `translate(${d.tx}px,${d.ty}px) scale(${d.sc}) rotate(${d.rot1}deg)`;
            el.style.opacity    = "0";
            if (d.bl) el.style.filter = `blur(${d.bl}px)`;
          });
        }
        if (burstIdx < burstData.length) requestAnimationFrame(spawnBatch);
      };
      requestAnimationFrame(spawnBatch);

      // Fade content block first
      const contentEl = loader.querySelector(".skl-content") as HTMLElement;
      contentEl.style.transition = "opacity 0.4s ease";
      contentEl.style.opacity    = "0";

      // Then fade the whole overlay
      setTimeout(() => {
        loader.style.transition = "opacity 0.5s ease";
        loader.style.opacity    = "0";
        setTimeout(() => done(loader, setMounted), 540);
      }, 620);
    }, PHASE1_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={ref}
      id="sakuraLoader"
      className="skl"
      role="status"
      aria-label="A carregar"
    >
      <div className="skl-particles" aria-hidden="true" />
      <div className="skl-content">
        <div className="skl-brand">Flor Alva</div>
        <div className="skl-sep" aria-hidden="true" />
        <div
          className="skl-progress"
          role="progressbar"
          aria-label="A carregar"
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="skl-burst" aria-hidden="true" />
    </div>
  );
}

























































































































































































































































