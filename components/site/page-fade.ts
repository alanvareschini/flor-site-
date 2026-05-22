/**
 * Page transition utilities:
 *   expandCard()  -- clip-path reveal from card rect to fullscreen
 *   dissolveCard() -- cross-dissolve the card overlay to reveal the WebGL canvas
 *   fadeOut()     -- simple black fade for back navigation
 */

const OVERLAY_ID = "pf-overlay";

function getOverlay(): HTMLDivElement {
  let el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = OVERLAY_ID;
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      background: "#000",
      zIndex: "99999",
      pointerEvents: "none",
      opacity: "0",
    });
    document.body.appendChild(el);
  }
  return el;
}

export function fadeOut(ms = 280): Promise<void> {
  return new Promise((resolve) => {
    const el = getOverlay();
    el.style.transition = "opacity " + ms + "ms ease";
    el.style.pointerEvents = "all";
    void el.getBoundingClientRect();
    el.style.opacity = "1";
    setTimeout(resolve, ms);
  });
}

export interface CardRect {
  left: number; top: number; width: number; height: number;
}

const CARD_ID = "pf-card";

function getCardOverlay(): HTMLDivElement {
  let el = document.getElementById(CARD_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = CARD_ID;
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      backgroundSize: "cover",
      backgroundPosition: "center",
      willChange: "clip-path",
      zIndex: "99998",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
  }
  return el;
}

export function expandCard(rect: CardRect, poster: string): Promise<void> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const inTop    = rect.top;
  const inBottom = vh - (rect.top + rect.height);
  const inLeft   = rect.left;
  const inRight  = vw - (rect.left + rect.width);

  const el = getCardOverlay();
  el.style.backgroundImage = "url(\"" + poster + "\")";
  el.style.opacity = "1";
  el.style.transition = "none";
  el.style.clipPath = "inset(" + inTop + "px " + inRight + "px " + inBottom + "px " + inLeft + "px)";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = "clip-path 0.72s cubic-bezier(0.76,0,0.24,1)";
      el.style.clipPath = "inset(0px 0px 0px 0px)";
    });
  });

  return new Promise((resolve) => setTimeout(resolve, 540));
}

export function dissolveCard(ms = 600): void {
  const el = document.getElementById(CARD_ID) as HTMLDivElement | null;
  if (!el) return;
  el.style.transition = "opacity " + ms + "ms ease";
  el.style.opacity = "0";
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, ms + 80);
}

export function removeCardOverlay(): void {
  const el = document.getElementById(CARD_ID);
  if (el?.parentNode) {
    el.parentNode.removeChild(el);
  }
}

export function holdZoomFrame(src: string): void {
  const el = getCardOverlay();
  el.style.backgroundImage = "url(\"" + src + "\")";
  el.style.backgroundSize = "cover";
  el.style.backgroundPosition = "center";
  el.style.opacity = "1";
  el.style.transition = "none";
  el.style.clipPath = "inset(0px 0px 0px 0px)";
  el.style.willChange = "opacity";
}

export function holdCanvasFrame(canvas: HTMLCanvasElement, fallbackPoster?: string): void {
  try {
    holdZoomFrame(canvas.toDataURL("image/jpeg", 0.92));
  } catch {
    if (fallbackPoster) {
      holdZoomFrame(fallbackPoster);
    }
  }
}
