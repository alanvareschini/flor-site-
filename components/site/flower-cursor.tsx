"use client";

import { useEffect, useRef } from "react";

const COLORS_RGB = [
  [255, 140, 170],
  [255, 100, 145],
  [230, 100, 200],
  [255, 200, 220],
  [255, 230, 80],
  [200, 160, 255],
  [255, 255, 200],
  [180, 230, 130]
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  alpha: number;
  alphaMax: number;
  decay: number;
  rgb: number[];
  kind: "petal" | "circle";
};

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function drawPetalShape(ctx: CanvasRenderingContext2D, size: number) {
  const w = size * 0.42;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(w, -size * 0.35, w, -size * 0.9, 0, -size);
  ctx.bezierCurveTo(-w, -size * 0.9, -w, -size * 0.35, 0, 0);
  ctx.closePath();
}

function inNoTrailZone(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node && node !== document.body) {
    if (node.dataset?.noTrail !== undefined) return true;
    node = node.parentElement;
  }
  return false;
}

export function FlowerCursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const pool: Particle[] = [];
    let lastX = -9999;
    let lastY = -9999;
    let rafId: number | null = null;
    let lastNow = performance.now();

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      ctx.clearRect(0, 0, W, H);
    };

    const tick = (now: number) => {
      rafId = null;
      const dt = Math.min(now - lastNow, 50);
      lastNow = now;

      ctx.clearRect(0, 0, W, H);

      for (let i = pool.length - 1; i >= 0; i -= 1) {
        const p = pool[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.025;
        p.vx += rnd(-0.04, 0.04);
        p.rotation += p.rotSpeed;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          pool.splice(i, 1);
          continue;
        }

        const a = p.alpha;
        const [r, g, b] = p.rgb;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.kind === "petal") {
          drawPetalShape(ctx, p.size);
          const grad = ctx.createLinearGradient(0, 0, 0, -p.size);
          grad.addColorStop(0, `rgba(${r},${g},${b},${(a * 0.6).toFixed(3)})`);
          grad.addColorStop(0.5, `rgba(${r},${g},${b},${a.toFixed(3)})`);
          grad.addColorStop(1, `rgba(255,255,255,${(a * 0.9).toFixed(3)})`);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = `rgba(${r},${g},${b},${(a * 0.5).toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
          ctx.fill();
        }

        ctx.restore();
      }

      if (pool.length > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const startLoop = () => {
      if (rafId !== null) return;
      lastNow = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const spawn = (x: number, y: number) => {
      const kind: Particle["kind"] = Math.random() < 0.82 ? "petal" : "circle";
      const alphaMax = rnd(0.75, 1);

      pool.push({
        x,
        y,
        vx: rnd(-1.8, 1.8),
        vy: -rnd(1.4, 3.8),
        rotation: rnd(0, Math.PI * 2),
        rotSpeed: rnd(-0.06, 0.06),
        size: kind === "petal" ? rnd(8, 20) : rnd(3, 7),
        alpha: alphaMax,
        alphaMax,
        decay: rnd(0.00035, 0.0007),
        rgb: pick(COLORS_RGB),
        kind
      });

      if (pool.length > 96) pool.splice(0, pool.length - 96);
      startLoop();
    };

    const onMove = (e: MouseEvent) => {
      if (inNoTrailZone(e.target)) {
        pool.length = 0;
        ctx.clearRect(0, 0, W, H);
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 6) return;
      lastX = e.clientX;
      lastY = e.clientY;

      const count = Math.min(Math.ceil(d / 8), 5);
      for (let i = 0; i < count; i += 1) {
        spawn(e.clientX + rnd(-6, 6), e.clientY + rnd(-6, 6));
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("resize", resize);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9997,
        pointerEvents: "none"
      }}
    />
  );
}
