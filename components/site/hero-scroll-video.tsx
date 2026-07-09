
"use client";

import clsx from "clsx";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import * as THREE from "three";
import { dissolveCard, removeCardOverlay } from "./page-fade";
import { routeManagerPlus } from "./route-manager-plus";
import { ROOT_PATH, WORKS, WORKS_PATH, worksPath } from "@/data/works";

const CenasGridSection = dynamic(
  () => import("./cenas-grid").then((module) => module.CenasGridSection),
  { loading: () => null, ssr: false }
);

type HomeSlide = {
  kind: "opening" | "work";
  id: string;
  kicker: string;
  heading: string;
  title: string;
  subtitle: string;
  src: string;
  poster: string;
  path: string;
  previewFrame: number;
};

const HERO_FRAME_COUNT = 689;
const INTRO_SCROLL_UNITS = 7.6;
const WORK_SCROLL_UNITS = 0.9;
const HOME_SCROLL_UNITS = INTRO_SCROLL_UNITS + WORKS.length * WORK_SCROLL_UNITS;
const HOME_SECTION_DVH = Math.ceil((HOME_SCROLL_UNITS + 1) * 100);
const OPENING_SEEN_KEY = "flor-alva-opening-seen";
const LOOP_SCROLL_DVH = 720;
const WHEEL_FORCE = 0.0002;
const TOUCH_FORCE = 0.0005;
const KEY_FORCE = 0.05;
const OPENING_MAX_SCROLL_VELOCITY = 0.24;
const OPENING_VELOCITY_DECAY = 0.82;
const TAO_SMOOTH_SCROLL_FORCE = 0.002;
const TAO_SMOOTH_SCROLL_DECAY = 0.9;
const TAO_SMOOTH_SCROLL_LIMIT = 0.02;
const TAO_SMOOTH_WHEEL_MS = 150;
const TAO_MAX_SCROLL_IMPULSE = 0.05;
const TAO_WHEEL_DECAY = 0.8;
const TAO_TOUCH_DECAY = 0.85;
const TAO_SNAP_THRESHOLD = TAO_MAX_SCROLL_IMPULSE * 0.25;
const TAO_SNAP_FORCE = 0.035;
const TAO_SETTLE_EPSILON = 0.001;
const SCROLL_SNAP_IDLE_MS = 110;
// Tao's ControllerSlideSliding: captions hide the moment slideIndex changes
// (midpoint crossing) and reappear 0.7s after the LAST change — a debounce, not
// a per-frame velocity/progress threshold. The route commits on the same timer.
const CAPTION_REVEAL_DEBOUNCE_MS = 700;
// Tao's ControllerSlideDetails offset: base 30, scaled by the viewport aspect on
// the dominant axis (x *= w/h when wide, y *= h/w when tall), signed by slideDir.
const CAPTION_SLIDE_BASE = 30;
const VISUAL_PROGRESS_RESPONSE_MIN = 0.32;
const VISUAL_PROGRESS_RESPONSE_MAX = 0.68;
const VISUAL_VELOCITY_RESPONSE = 0.24;
const ROUTE_SETTLE_MS = CAPTION_REVEAL_DEBOUNCE_MS;
const MAX_SHADER_PIXEL_RATIO = 1.5;
const SLIDE_PREVIEW_MAX_CONNECTIONS = 2;

const taoVideoSlideVertexShader = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

varying vec2 vUv;
varying vec2 vUv1;
varying vec2 vUv2;

uniform vec4 uvRate1;
uniform vec4 uvRate2;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  vec2 _uv = uv - 0.5;

  vUv1 = _uv;
  vUv1 *= uvRate1.xy;
  vUv1 += 0.5;

  vUv2 = _uv;
  vUv2 *= uvRate2.xy;
  vUv2 += 0.5;

  _uv += 0.5;
  vUv = _uv;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const taoVideoSlideFragmentShader = `
precision highp float;

varying vec2 vUv;
varying vec2 vUv1;
varying vec2 vUv2;

uniform vec4 time;
uniform float progress;
uniform vec3 mask;
uniform vec4 translateDelay;
uniform vec2 accel;
uniform vec4 waveAmpFreq;
uniform vec4 waveSpeedBlend;
uniform vec4 pixels;
uniform sampler2D texture1;
uniform sampler2D texture2;

float mirrored(float v) {
  float m = mod(v, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

vec2 mirrored(vec2 v) {
  vec2 m = mod(v, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

float tri(float v) {
  return mix(v, 1.0 - v, step(0.5, v)) * 2.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / pixels.xy;
  float p = fract(progress + mask.z);

  float delayValue = p * (1.0 + translateDelay.z + translateDelay.w)
                   - uv.y * translateDelay.w
                   - (1.0 - uv.x) * translateDelay.z;
  delayValue = clamp(delayValue, 0.0, 1.0);

  vec2 translateValue = p + delayValue * accel;
  vec2 translateValue1 = translateDelay.xy * translateValue;
  vec2 translateValue2 = translateDelay.xy * (translateValue - 1.0 - accel);
  vec2 w = sin(time.y * waveSpeedBlend.xy + vUv.yx * waveAmpFreq.zw) * waveAmpFreq.xy;
  vec2 xy = (tri(p) * waveSpeedBlend.z + tri(delayValue) * waveSpeedBlend.w) * w;

  vec2 uv1 = vUv1 + translateValue1 + xy;
  vec2 uv2 = vUv2 + translateValue2 + xy;
  vec4 rgba1 = texture2D(texture1, mirrored(uv1));
  vec4 rgba2 = texture2D(texture2, mirrored(uv2));
  vec4 rgba = mix(rgba1, rgba2, delayValue);

  rgba = mix(vec4(0.0, 0.0, 0.0, 1.0), rgba, mask.y);
  rgba = mix(vec4(0.0), rgba, float(abs(uv.y * 2.0 - 1.0) <= mask.x));
  gl_FragColor = rgba;
}
`;

const openingSlide: HomeSlide = {
  kind: "opening",
  id: "000",
  kicker: "Filme de abertura",
  heading: "Flor Alva",
  title: "Desabrochar",
  subtitle: "Flor branca em suspensao",
  src: "",
  poster: "/frames/frame_001.webp",
  path: ROOT_PATH,
  previewFrame: 1
};

const homeSlides: HomeSlide[] = [
  openingSlide,
  ...WORKS.map((work) => ({
    kind: "work" as const,
    id: work.id,
    kicker: `#${work.id} / ${work.categoryEn}`,
    heading: work.titleEn,
    title: work.titleEn,
    subtitle: work.descriptionEn,
    src: work.src,
    poster: work.poster,
    path: worksPath(work),
    previewFrame: HERO_FRAME_COUNT
  }))
];

// Tao Tajima serves each clip at a resolution matched to the device (his
// `vimeo_digest` carries per-size encodes). We mirror that with two local
// encodes per work — `<slug>.mp4` (1080p30) and `<slug>-720.mp4` (720p30) — and
// pick once on the client. 720p roughly quarters the WebGL decode cost vs the
// original 1080p/60, which is what removes the stutter on smaller/weaker
// devices while large screens keep full resolution.
function lowResVideoSrc(src: string) {
  return src ? src.replace(/\.mp4$/i, "-720.mp4") : src;
}

let heroVideoQualityApplied = false;

function applyHeroVideoQuality() {
  if (heroVideoQualityApplied || typeof window === "undefined") return;
  heroVideoQualityApplied = true;

  // Tao serves 960x540@24 to EVERY device (upscaled fullscreen) — decode cost,
  // not bitrate, is what stutters the WebGL loop, because transitions decode two
  // clips at once. 720p30 is our default everywhere; 1080p only on large
  // viewports with plenty of cores, where the 2x decode budget provably fits.
  const cores = navigator.hardwareConcurrency || 4;
  const useHighRes = window.innerWidth >= 1600 && cores >= 8;
  if (useHighRes) return;

  // Mutate both the hero slides and the shared WORKS list (the works grid reads
  // WORKS directly) so every video src/comparison across the app resolves to the
  // same 720p variant — keeping the dataset.src === slide.src checks consistent.
  for (const slide of homeSlides) {
    if (slide.kind === "work" && slide.src) {
      slide.src = lowResVideoSrc(slide.src);
    }
  }

  for (const work of WORKS) {
    if (work.src) {
      work.src = lowResVideoSrc(work.src);
    }
  }
}

// Delay before the works grid cards play their entry drop, once the zoom-out
// into the list has mostly landed.
const WORKS_ENTRY_CARDS_MS = 760;

const captionPalettes = [
  ["#f49bc7", "#ffffff", "#ff5fa8", "#ffcfdf"],
  ["#58b7ff", "#ffffff", "#4f7dff", "#b8f2ff"],
  ["#6fa8ff", "#ffffff", "#7260ff", "#c6d8ff"],
  ["#ff6d86", "#ffffff", "#c80f3b", "#ffd0dc"],
  ["#b974ff", "#ffffff", "#ff68c8", "#ecd2ff"],
  ["#aee4ff", "#ffffff", "#68b9ff", "#f6fbff"],
  ["#ff4358", "#fff5f5", "#f51e47", "#ffc4cd"],
  ["#ff8f13", "#fff4a8", "#ff4300", "#ffd84a"],
  ["#bd86ff", "#ffffff", "#7952ff", "#ffd2ff"],
  ["#ffc525", "#fff8a6", "#e19100", "#ffe866"],
  ["#ffe0ea", "#ffffff", "#f1a7c3", "#fff2f6"],
  ["#9469ff", "#ffffff", "#5f41ff", "#d6beff"],
  ["#ffd21a", "#fff9b8", "#ff9f00", "#fff063"],
  ["#86adff", "#ffffff", "#537bff", "#d6e3ff"],
  ["#ff75d4", "#ffffff", "#b93cff", "#ffc6ef"],
  ["#c878ff", "#ffffff", "#8d44ff", "#edd2ff"],
  ["#9870ff", "#ffffff", "#5f3dff", "#d6c2ff"],
  ["#ff4fb8", "#fff1fa", "#b52eff", "#ffbde3"],
  ["#8f5cff", "#ffffff", "#6039c9", "#d0b8ff"],
  ["#ff3030", "#fff1f1", "#b80024", "#ffb3b3"]
];

function getCaptionPalette(slide: HomeSlide) {
  if (slide.kind !== "work") {
    return ["#ffffff", "#ffd9e8", "#ff87bd", "#ffffff"];
  }

  const index = Math.max(0, WORKS.findIndex((work) => worksPath(work) === slide.path));
  return captionPalettes[index] ?? ["#ffffff", "#e8f3ff", "#9ccfff", "#ffffff"];
}

function getCaptionFontSize(_title: string) {
  return 124;
}

function getCaptionLetterSpacing(_title: string) {
  return "0.045em";
}

function getCaptionGradientStyle(slide: HomeSlide): CSSProperties {
  const palette = getCaptionPalette(slide);

  return {
    "--caption-c1": palette[0],
    "--caption-c2": palette[1],
    "--caption-c3": palette[2],
    "--caption-c4": palette[3]
  } as CSSProperties;
}

function heroFrameSrc(frame: number) {
  const clampedFrame = Math.max(1, Math.min(HERO_FRAME_COUNT, Math.round(frame)));
  return `/frames/frame_${String(clampedFrame).padStart(3, "0")}.webp`;
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(edge1 - edge0, 0.0001)));
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWheelAmount(event: WheelEvent) {
  const dominantDelta =
    Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return dominantDelta * 40;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return dominantDelta * Math.max(window.innerHeight, 720);
  }

  return dominantDelta;
}

function shouldUseTaoSmoothWheelPath() {
  const platform = `${navigator.platform} ${navigator.userAgent}`;

  return !/(Mac|iPhone|iPad|iPod)/i.test(platform);
}

function modulo(value: number, total: number) {
  return ((value % total) + total) % total;
}

function nearestLoopTarget(current: number, target: number, total: number) {
  const wrappedCurrent = modulo(current, total);
  let delta = target - wrappedCurrent;

  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;

  return current + delta;
}

function getOpeningAvailableOnLoad() {
  if (typeof window === "undefined") return true;
  if (window.location.pathname !== ROOT_PATH) return false;

  try {
    return window.localStorage.getItem(OPENING_SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

function initialSceneFromPath() {
  if (typeof window === "undefined") return 0;
  const routeScene = Math.max(0, routeManagerPlus.getSlideIndexByPath(window.location.pathname));

  if (window.location.pathname === ROOT_PATH && !getOpeningAvailableOnLoad()) {
    return 1;
  }

  return routeScene;
}

function sourceForSlide(slide: HomeSlide) {
  return slide.kind === "work" ? slide.src : "";
}

function coverUvRate(textureWidth: number, textureHeight: number, viewWidth: number, viewHeight: number) {
  const textureAspect = textureWidth / Math.max(textureHeight, 1);
  const viewAspect = viewWidth / Math.max(viewHeight, 1);

  if (viewAspect > textureAspect) {
    return new THREE.Vector4(1, viewAspect / textureAspect, 1, 1);
  }

  return new THREE.Vector4(textureAspect / viewAspect, 1, 1, 1);
}

function createBlankTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext("2d")?.clearRect(0, 0, 1, 1);
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function getShaderPixelRatio() {
  if (typeof window === "undefined") return 1;

  const pixelArea = window.innerWidth * window.innerHeight * Math.max(1, window.devicePixelRatio || 1);
  const maxRatio = pixelArea > 2_800_000 ? 1.25 : MAX_SHADER_PIXEL_RATIO;
  return Math.min(window.devicePixelRatio || 1, maxRatio);
}

function shuffledCorners() {
  const values = [0, 1, 2, 3];

  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

const worksZoomVertexShader = `
precision highp float;

uniform vec2 uListPosition;
uniform vec2 uListSize;
uniform vec2 uSlideSize;
uniform float uSway;
uniform vec4 uCorners;
uniform float uZoomScale;
uniform float uTime;

varying vec2 vUv;
varying float vDark;
varying float vMorph;

const float PI = 3.14159265359;
const float AREA2 = 700.0;

void main() {
  vUv = uv;

  float corner = mix(
    mix(uCorners.z, uCorners.w, uv.x),
    mix(uCorners.x, uCorners.y, uv.x),
    uv.y
  );

  vec2 local = position.xy;
  vec2 listXY = uListPosition + local * uListSize;
  vec2 slideXY = local * uSlideSize;

  float len2 = length(listXY);
  float listStrength = clamp(1.0 - len2 / AREA2, 0.25, 1.0);
  float sway = (
    sin(uTime * 1.0 + len2 / 256.0) * 128.0 +
    sin(uTime * 2.0 + len2 / 32.0) * 64.0
  ) * uSway;
  float centreFold = sin(uv.x * PI) * sin(uv.y * PI) * uSway * 42.0;

  vec4 listPosition = vec4(listXY, sway * listStrength, 1.0);
  vec4 slidePosition = vec4(slideXY, uZoomScale + sway + centreFold, 1.0);

  vMorph = corner;
  vDark = 1.0;
  gl_Position = projectionMatrix * viewMatrix * mix(listPosition, slidePosition, corner);
}
`;

const worksZoomFragmentShader = `
precision highp float;

uniform sampler2D uTexture;
uniform float uProgress;
uniform float uSway;
uniform float uTime;
uniform float uTextureAspect;
uniform float uListAspect;
uniform float uSlideAspect;

varying vec2 vUv;
varying float vDark;
varying float vMorph;

float mirrored(float v) {
  float m = mod(v, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

vec2 mirrored(vec2 v) {
  vec2 m = mod(v, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

float tri(float v) {
  return mix(v, 1.0 - v, step(0.5, v)) * 2.0;
}

vec2 coverUv(vec2 uv, float planeAspect, float textureAspect) {
  vec2 centered = uv - 0.5;

  if (planeAspect > textureAspect) {
    centered.y *= planeAspect / textureAspect;
  } else {
    centered.x *= textureAspect / planeAspect;
  }

  return centered + 0.5;
}

void main() {
  vec2 uv = vUv;
  float aspect = mix(uListAspect, uSlideAspect, smoothstep(0.08, 0.92, vMorph));
  vec2 sampleUv = coverUv(uv, aspect, uTextureAspect);

  float delayValue = clamp(
    uProgress * 2.15 - uv.y * 0.65 - (1.0 - uv.x) * 0.35,
    0.0,
    1.0
  );
  vec2 wave = sin(uTime * vec2(0.3, 0.2) + uv.yx * vec2(4.0, 4.0)) * 0.012;
  vec2 offset = wave * uSway * (tri(uProgress) * 0.45 + tri(delayValue) * 0.55);

  vec4 color = texture2D(uTexture, mirrored(sampleUv + offset));
  color.rgb *= vDark;
  color.a = 1.0;
  gl_FragColor = color;
}
`;

type WorksZoomTransitionProps = {
  active: boolean;
  direction: "open" | "close";
  sourceImageSrc: string;
  // Resolves the LIVE video element that should morph during the zoom (Tao
  // morphs the playing slide plane itself — a still here reads as a freeze).
  getSourceVideo: () => HTMLVideoElement | null;
  targetWorkIndex: number;
  worksLayerRef: RefObject<HTMLDivElement | null>;
  onComplete: () => void;
};

function WorksZoomTransition({
  active,
  direction,
  sourceImageSrc,
  getSourceVideo,
  targetWorkIndex,
  worksLayerRef,
  onComplete
}: WorksZoomTransitionProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completeRef = useRef(onComplete);
  const getSourceVideoRef = useRef(getSourceVideo);

  useEffect(() => {
    completeRef.current = onComplete;
    getSourceVideoRef.current = getSourceVideo;
  }, [onComplete, getSourceVideo]);

  useEffect(() => {
    if (!active) return;

    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    const works = worksLayerRef.current;

    if (!overlay || !canvas) {
      completeRef.current();
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let tween: gsap.core.Timeline | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let geometry: THREE.PlaneGeometry | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let texture: THREE.Texture | null = null;
    let textureWidth = 1920;
    let textureHeight = 1080;
    let isLiveVideoTexture = false;

    gsap.set(overlay, { autoAlpha: 1, pointerEvents: "auto" });

    if (works) {
      gsap.set(works, {
        autoAlpha: direction === "open" ? 0 : 1,
        pointerEvents: "none"
      });
    }

    const configureTexture = (textureValue: THREE.Texture) => {
      textureValue.colorSpace = THREE.SRGBColorSpace;
      textureValue.minFilter = THREE.LinearFilter;
      textureValue.magFilter = THREE.LinearFilter;
      textureValue.wrapS = THREE.ClampToEdgeWrapping;
      textureValue.wrapT = THREE.ClampToEdgeWrapping;
      textureValue.generateMipmaps = false;
      textureValue.needsUpdate = true;
      return textureValue;
    };

    const fallbackTargetRect = () => {
      const width = Math.min(325, Math.max(230, window.innerWidth * 0.24));
      const height = width * 9 / 16;
      return {
        left: Math.max(40, window.innerWidth * 0.12),
        top: Math.max(90, window.innerHeight * 0.18),
        width,
        height
      };
    };

    const getLayoutRectInScrollRoot = (root: HTMLElement, target: HTMLElement) => {
      let left = 0;
      let top = 0;
      let node: HTMLElement | null = target;

      while (node && node !== root) {
        left += node.offsetLeft;
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }

      if (!node) {
        return target.getBoundingClientRect();
      }

      const rootRect = root.getBoundingClientRect();
      return {
        left: rootRect.left + left,
        top: rootRect.top + top - root.scrollTop,
        width: target.offsetWidth || target.getBoundingClientRect().width,
        height: target.offsetHeight || target.getBoundingClientRect().height,
        right: rootRect.left + left + (target.offsetWidth || target.getBoundingClientRect().width),
        bottom:
          rootRect.top +
          top -
          root.scrollTop +
          (target.offsetHeight || target.getBoundingClientRect().height)
      };
    };

    const resolveTargetRect = async () => {
      for (let attempt = 0; attempt < 90; attempt += 1) {
        const root = worksLayerRef.current;
        const target = root?.querySelector<HTMLElement>(
          `[data-work-media-index="${targetWorkIndex}"]`
        );

        if (root && target) {
          const rootRect = root.getBoundingClientRect();
          const initialRect = getLayoutRectInScrollRoot(root, target);
          const desiredTop =
            root.scrollTop +
            initialRect.top -
            rootRect.top -
            Math.max(60, (root.clientHeight - initialRect.height) * 0.42);

          root.scrollTop = Math.max(0, desiredTop);

          await new Promise((resolve) => requestAnimationFrame(resolve));

          const rect = getLayoutRectInScrollRoot(root, target);

          if (
            rect.width > 20 &&
            rect.height > 20 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight
          ) {
            return rect;
          }
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      const root = worksLayerRef.current;
      const target = root?.querySelector<HTMLElement>(
        `[data-work-media-index="${targetWorkIndex}"]`
      );
      const rect = root && target ? getLayoutRectInScrollRoot(root, target) : target?.getBoundingClientRect();

      if (rect && rect.width > 20 && rect.height > 20) {
        return rect;
      }

      return fallbackTargetRect();
    };

    const cleanup = () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      tween?.kill();
      renderer?.dispose();
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      gsap.set(canvas, { opacity: 0 });
      gsap.set(overlay, { autoAlpha: 0, pointerEvents: "none" });
    };

    // The caller resolves which element is actually feeding the slide (shared
    // grid video, preview-pool entry or warmed currentVideo), so relevance is
    // guaranteed — only renderability is checked here. Works for BOTH
    // directions: Tao's zoom flies a playing video in and out of the card.
    const canUseVideoTexture = (video: HTMLVideoElement | null): video is HTMLVideoElement =>
      Boolean(
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      );

    void (async () => {
      try {
        const sourceVideo = getSourceVideoRef.current();

        if (canUseVideoTexture(sourceVideo)) {
          texture = configureTexture(new THREE.VideoTexture(sourceVideo));
          textureWidth = sourceVideo.videoWidth || 1920;
          textureHeight = sourceVideo.videoHeight || 1080;
          isLiveVideoTexture = true;
        } else {
          texture = configureTexture(await new THREE.TextureLoader().loadAsync(sourceImageSrc));
          const textureImage = texture.image as HTMLImageElement | undefined;
          textureWidth = textureImage?.naturalWidth || textureImage?.width || 1920;
          textureHeight = textureImage?.naturalHeight || textureImage?.height || 1080;
        }
      } catch {
        if (!cancelled) {
          if (works) {
            gsap.set(works, {
              autoAlpha: direction === "open" ? 1 : 0,
              pointerEvents: direction === "open" ? "auto" : "none"
            });
          }

          completeRef.current();
        }
        return;
      }

      if (cancelled || !texture) return;

      const width = Math.max(1, window.innerWidth || canvas.clientWidth);
      const height = Math.max(1, window.innerHeight || canvas.clientHeight);
      const targetRect = await resolveTargetRect();
      const pixelRatio = getShaderPixelRatio();

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(pixelRatio);
      renderer.setClearColor(0xffffff, 0);
      renderer.setSize(width, height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, width / Math.max(height, 1), 0.1, 10000);
      camera.position.z = (height / 2) / Math.tan((60 * Math.PI / 180) / 2);
      camera.updateProjectionMatrix();

      geometry = new THREE.PlaneGeometry(1, 1, 96, 54);

      const uniforms = {
        uTexture: { value: texture },
        uListPosition: {
          value: new THREE.Vector2(
            targetRect.left + targetRect.width / 2 - width / 2,
            height / 2 - (targetRect.top + targetRect.height / 2)
          )
        },
        uListSize: { value: new THREE.Vector2(targetRect.width, targetRect.height) },
        uSlideSize: { value: new THREE.Vector2(width * 1.02, height * 1.02) },
        uTextureAspect: { value: textureWidth / Math.max(textureHeight, 1) },
        uListAspect: { value: targetRect.width / Math.max(targetRect.height, 1) },
        uSlideAspect: { value: width / Math.max(height, 1) },
        uZoomScale: { value: Math.min(width, height) * 0.065 },
        uSway: { value: 0 },
        uCorners: { value: new THREE.Vector4(0, 0, 0, 0) },
        uProgress: { value: direction === "open" ? 1 : 0 },
        uTime: { value: 0 }
      };

      material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: worksZoomVertexShader,
        fragmentShader: worksZoomFragmentShader,
        depthTest: false,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);

      const cornerDelays = [0, 0.1, 0.2, 0.3];
      const cornerOrder = shuffledCorners();
      const progress = {
        p1: direction === "open" ? 0.5 : 0,
        p2: direction === "open" ? 0.5 : 0
      };
      const startedAt = performance.now();

      const apply = () => {
        const e = progress.p1 + progress.p2;
        const t = smoothStep(0, 0.9, e);
        const sway = t < 0.5 ? 2 * t : 2 * (1 - t);
        const listAlpha = 1 - smoothStep(0.1, 0.6, e);

        uniforms.uTime.value = (performance.now() - startedAt) / 1000;
        uniforms.uSway.value = sway;
        uniforms.uProgress.value = t;
        uniforms.uCorners.value.set(
          smoothStep(cornerDelays[cornerOrder[0]], 0.7, e),
          smoothStep(cornerDelays[cornerOrder[1]], 0.7, e),
          smoothStep(cornerDelays[cornerOrder[2]], 0.7, e),
          smoothStep(cornerDelays[cornerOrder[3]], 0.7, e)
        );

        if (works) {
          gsap.set(works, { autoAlpha: listAlpha });
        }
      };

      const render = () => {
        if (cancelled || !renderer) return;

        apply();
        if (isLiveVideoTexture && texture) {
          texture.needsUpdate = true;
        }
        renderer.render(scene, camera);
        frameId = window.requestAnimationFrame(render);
      };

      gsap.set(canvas, { opacity: 1 });
      render();

      tween = gsap.timeline({
        onComplete: () => {
          if (cancelled) return;

          if (works) {
            gsap.set(works, {
              autoAlpha: direction === "open" ? 1 : 0,
              pointerEvents: direction === "open" ? "auto" : "none"
            });
          }

          gsap.to(canvas, {
            opacity: 0,
            duration: 0.12,
            ease: "power1.out",
            onComplete: () => {
              cleanup();
              completeRef.current();
            }
          });
        }
      });

      if (direction === "open") {
        tween.to(progress, { p1: 0, duration: 1.6, ease: "power3.inOut" }, 0);
        tween.to(progress, { p2: 0, duration: 1.6, ease: "power3.inOut" }, 0);
      } else {
        tween.to(progress, { p1: 0.5, duration: 1.2, ease: "power3.inOut" }, 0);
        tween.to(progress, { p2: 0.5, duration: 1.5, ease: "power2.inOut" }, 0);
      }
    })();

    return cleanup;
  }, [active, direction, sourceImageSrc, targetWorkIndex, worksLayerRef]);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] opacity-0"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

type SlideTextureSlot = {
  image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
  width: number;
  height: number;
  texture?: THREE.Texture;
};

type SlidePreviewEntry = {
  index: number;
  src: string;
  slide: HomeSlide;
  video: HTMLVideoElement;
  texture: THREE.VideoTexture | null;
  state: "queued" | "loading" | "ready" | "error";
  countedLoad: boolean;
};

type PosterTextureCacheEntry = {
  image: HTMLImageElement | null;
  width: number;
  height: number;
  ready: boolean;
};

type SlideShaderRuntime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  geometry: THREE.PlaneGeometry;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.RawShaderMaterial>;
  material: THREE.RawShaderMaterial;
  uniforms: {
    texture1: { value: THREE.Texture };
    texture2: { value: THREE.Texture };
    uvRate1: { value: THREE.Vector4 };
    uvRate2: { value: THREE.Vector4 };
    progress: { value: number };
    mask: { value: THREE.Vector3 };
    translateDelay: { value: THREE.Vector4 };
    accel: { value: THREE.Vector2 };
    waveAmpFreq: { value: THREE.Vector4 };
    waveSpeedBlend: { value: THREE.Vector4 };
    pixels: { value: THREE.Vector4 };
    velocity: { value: number };
    direction: { value: number };
    time: { value: THREE.Vector4 };
  };
  imageTexture1: THREE.Texture;
  imageTexture2: THREE.Texture;
  texture1: THREE.Texture;
  texture2: THREE.Texture;
  pairKey: string;
  width: number;
  height: number;
  pixelRatio: number;
  lastProgress: number;
  lastVelocity: number;
  lastDirection: number;
  lastTexture1Version: number;
  lastTexture2Version: number;
  hasRendered: boolean;
};

export function HeroScrollVideoSection() {
  const captionFilterId = useId().replace(/:/g, "");
  const sectionRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<HTMLImageElement | null>(null);
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);
  const posterOverlayRef = useRef<HTMLImageElement | null>(null);
  const transitionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captionLayerRef = useRef<HTMLDivElement | null>(null);
  const currentVideoSrcRef = useRef("");
  const activeSceneRef = useRef(0);
  const returnSceneRef = useRef(0);
  const worksLayerRef = useRef<HTMLDivElement | null>(null);
  const currentFrameIndexRef = useRef(1);
  const worksTimingTimersRef = useRef<number[]>([]);
  const slideShaderRef = useRef<SlideShaderRuntime | null>(null);
  const currentVideoTextureRef = useRef<{ src: string; texture: THREE.VideoTexture } | null>(null);
  // Video bridge for the works->slide handoff: the hero renders the SAME <video>
  // element the grid zoomed, so both canvases show identical frames (no seam),
  // until the hero's own preview for that work is ready.
  const sharedSlideVideoRef = useRef<{ index: number; video: HTMLVideoElement } | null>(null);
  const sharedSlideTextureRef = useRef<{ video: HTMLVideoElement; texture: THREE.VideoTexture } | null>(null);
  const slideRafRef = useRef<number | null>(null);
  const targetWorkPositionRef = useRef(0);
  const workPositionRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const smoothScrollImpulseRef = useRef(0);
  const smoothWheelDirectionRef = useRef(0);
  const smoothWheelPulseUntilRef = useRef(0);
  const touchImpulseRef = useRef(0);
  const visualVelocityRef = useRef(0);
  const scrollDirectionRef = useRef(1);
  const lastScrollInputAtRef = useRef(0);
  const openingProgressRef = useRef(0);
  const openingVelocityRef = useRef(0);
  const isOpeningSceneRef = useRef(false);
  const touchPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeTweenRef = useRef<gsap.core.Tween | null>(null);
  const routeCommitTimerRef = useRef<number | null>(null);
  const slidePreviewEntriesRef = useRef<Map<number, SlidePreviewEntry>>(new Map());
  const slidePreviewQueueRef = useRef<number[]>([]);
  const slidePreviewLoadingRef = useRef(0);
  const slidePreviewDesiredRef = useRef<Set<number>>(new Set());
  const slidePreviewFlushTimerRef = useRef<number | null>(null);
  const slidePreviewRangeKeyRef = useRef("");
  const posterTextureCacheRef = useRef<Map<string, PosterTextureCacheEntry>>(new Map());
  const isWorksActiveRef = useRef(false);
  const isZoomingWorksRef = useRef(false);
  const captionsVisibleRef = useRef(true);
  const captionSceneRef = useRef(0);
  const captionRevealTimerRef = useRef<number | null>(null);

  const [activeScene, setActiveScene] = useState(0);
  const [captionScene, setCaptionScene] = useState(0);
  const [captionExitScene, setCaptionExitScene] = useState<number | null>(null);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [openingAvailable, setOpeningAvailable] = useState(true);
  const [isListView, setIsListView] = useState(false);
  const [isWorksView, setIsWorksView] = useState(false);
  const [isZoomingWorks, setIsZoomingWorks] = useState(false);
  const [shouldMountWorks, setShouldMountWorks] = useState(false);
  const [worksEntryKey, setWorksEntryKey] = useState(0);
  const [zoomDirection, setZoomDirection] = useState<"open" | "close">("open");
  const [transitionFrameSrc, setTransitionFrameSrc] = useState(() => heroFrameSrc(1));
  const [transitionWorkIndex, setTransitionWorkIndex] = useState(0);
  const openingAvailableRef = useRef(openingAvailable);

  const isWorksActive = isWorksView || isZoomingWorks;
  const currentScene = homeSlides[activeScene] ?? openingSlide;
  const firstVisibleScene = openingAvailable ? 0 : 1;
  const previousSceneIndex =
    activeScene <= firstVisibleScene ? homeSlides.length - 1 : activeScene - 1;
  const nextSceneIndex = activeScene >= homeSlides.length - 1 ? firstVisibleScene : activeScene + 1;
  const previousScene = homeSlides[previousSceneIndex] ?? homeSlides[homeSlides.length - 1];
  const nextScene = homeSlides[nextSceneIndex] ?? homeSlides[firstVisibleScene];
  const visibleSceneNumber = Math.max(1, activeScene - firstVisibleScene + 1);
  const visibleSceneTotal = homeSlides.length - firstVisibleScene;
  const chromeTone = isListView || isWorksActive ? "text-[#171411]" : "text-white/88";
  const lineTone = isListView || isWorksActive ? "bg-[#171411]" : "bg-white/80";

  const setCaptionVisibility = (visible: boolean) => {
    if (captionsVisibleRef.current === visible) return;

    captionsVisibleRef.current = visible;
    setCaptionsVisible(visible);
  };

  const hideSceneCaptions = () => {
    setCaptionVisibility(false);
  };

  // Tao's show/hide tweens read a direction-signed offset of 30 scaled by the
  // dominant viewport axis. Written as CSS vars once per hide/reveal cycle (NOT
  // per frame) — the keyframes pick them up when the animation fires.
  const syncCaptionRevealOffsets = () => {
    const layer = captionLayerRef.current;
    if (!layer) return;

    const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    let offsetX = CAPTION_SLIDE_BASE;
    let offsetY = CAPTION_SLIDE_BASE;
    if (aspect > 1) {
      offsetX *= aspect;
    } else {
      offsetY *= 1 / Math.max(aspect, 0.0001);
    }

    const direction = scrollDirectionRef.current < 0 ? -1 : 1;
    layer.style.setProperty("--caption-reveal-x", `${(direction * offsetX).toFixed(2)}px`);
    layer.style.setProperty("--caption-reveal-y", `${(direction * offsetY).toFixed(2)}px`);
  };

  // Tao's ControllerSlideSliding._onChangeSlideIndex: hide the caption the moment
  // the slide index changes (midpoint crossing) and re-show it 0.7s after the
  // LAST change. A pure debounce — while the user keeps scrolling the timer keeps
  // resetting, so exactly ONE caption (the settled slide's) is ever revealed.
  const restartCaptionRevealTimer = () => {
    if (captionRevealTimerRef.current !== null) {
      window.clearTimeout(captionRevealTimerRef.current);
    }

    captionRevealTimerRef.current = window.setTimeout(() => {
      captionRevealTimerRef.current = null;

      if (isWorksActiveRef.current || isOpeningSceneRef.current) return;

      setCaptionExitScene(null);
      setCaptionVisibility(true);
    }, CAPTION_REVEAL_DEBOUNCE_MS);
  };

  // Move the on-screen caption to the exit panel (where it plays Tao's 0.5s
  // QuartIn slide-out) and hide the show panel. The show panel is only ever
  // hidden while its content is NOT on screen, so this never snaps visibly.
  const dismissCaptions = () => {
    if (captionsVisibleRef.current) {
      setCaptionExitScene(captionSceneRef.current);
    }
    hideSceneCaptions();
  };

  const hideCaptionsForSceneChange = (nextScene: number) => {
    syncCaptionRevealOffsets();
    dismissCaptions();

    if (captionSceneRef.current !== nextScene) {
      captionSceneRef.current = nextScene;
      setCaptionScene(nextScene);
    }

    restartCaptionRevealTimer();
  };

  const renderCaptionScene = (scene: HomeSlide, slot: "show" | "exit") => {
    const slotPalette = getCaptionPalette(scene);
    const slotGradientId = `${captionFilterId}-${slot}-caption-gradient`;
    const slotGlowId = `${captionFilterId}-${slot}-caption-soft-glow`;
    const slotFontSize = getCaptionFontSize(scene.heading);
    const slotLetterSpacing = getCaptionLetterSpacing(scene.heading);

    return (
      <div className={`flor-caption-sync-panel flor-caption-sync-${slot}`}>
        <p
          className={clsx(
            "flor-caption-sync-piece flor-caption-sync-kicker font-mono text-[11px] uppercase tracking-[0.48em] md:text-xs",
            isListView || isWorksActive ? "text-[#171411]/62" : "text-white/70"
          )}
        >
          {scene.kicker}
        </p>
        <h1
          className="flor-caption-sync-piece flor-caption-sync-heading flor-video-caption-heading mt-5"
          aria-label={scene.heading}
        >
          <span className="sr-only">{scene.heading}</span>
          <svg
            aria-hidden="true"
            className="flor-video-caption-svg"
            viewBox="-280 -24 1760 208"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter
                id={slotGlowId}
                x="-18%"
                y="-35%"
                width="136%"
                height="170%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur stdDeviation="3.5" result="glowA" />
                <feGaussianBlur stdDeviation="9" result="glowB" />
                <feMerge>
                  <feMergeNode in="glowB" />
                  <feMergeNode in="glowA" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient
                id={slotGradientId}
                gradientUnits="userSpaceOnUse"
                x1="-280"
                y1="0"
                x2="1480"
                y2="0"
              >
                <stop offset="0%" stopColor={slotPalette[0]} stopOpacity="0.92" />
                <stop offset="16%" stopColor={slotPalette[1]} stopOpacity="1" />
                <stop offset="34%" stopColor={slotPalette[2]} stopOpacity="1" />
                <stop offset="52%" stopColor={slotPalette[3]} stopOpacity="1" />
                <stop offset="70%" stopColor={slotPalette[0]} stopOpacity="1" />
                <stop offset="86%" stopColor={slotPalette[2]} stopOpacity="1" />
                <stop offset="100%" stopColor={slotPalette[1]} stopOpacity="0.92" />
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  values="-720 0; 720 0; -720 0"
                  dur="3.6s"
                  repeatCount="indefinite"
                />
              </linearGradient>
            </defs>
            <text
              className="flor-video-caption-line flor-video-caption-line-main"
              x="600"
              y="88"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={slotFontSize}
              letterSpacing={slotLetterSpacing}
              fill={`url(#${slotGradientId})`}
              stroke="none"
            >
              {scene.heading}
            </text>
          </svg>
        </h1>
        <p
          className={clsx(
            "flor-caption-sync-piece flor-caption-sync-title mt-4 text-sm uppercase tracking-[0.4em] md:text-[13px]",
            isListView || isWorksActive ? "text-[#171411]/58" : "text-white/70"
          )}
        >
          {scene.title}
        </p>
      </div>
    );
  };

  useEffect(() => {
    // Pick the per-device video resolution before any clip is requested so all
    // downstream src reads/comparisons stay consistent (slides hold one URL).
    applyHeroVideoQuality();
    return routeManagerPlus.init();
  }, []);

  useEffect(() => {
    void import("./cenas-grid");
  }, []);

  useEffect(() => {
    isWorksActiveRef.current = isWorksActive;
  }, [isWorksActive]);

  useEffect(() => {
    isZoomingWorksRef.current = isZoomingWorks;
  }, [isZoomingWorks]);

  useEffect(() => {
    activeSceneRef.current = activeScene;
  }, [activeScene]);

  useEffect(() => {
    openingAvailableRef.current = openingAvailable;
  }, [openingAvailable]);

  const clearWorksTimingTimers = () => {
    worksTimingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    worksTimingTimersRef.current = [];
  };

  const scheduleWorksFromClick = (callback: () => void, targetMs: number) => {
    const timer = window.setTimeout(callback, targetMs);
    worksTimingTimersRef.current.push(timer);
  };

  const setRouteForScene = (sceneIndex: number, replace = true) => {
    const path = routeManagerPlus.getPathBySlideIndex(sceneIndex);

    if (replace && typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.replaceState({ florAlvaRoute: true, path, hash: "", pop: true }, "", path);
    }

    if (routeManagerPlus.getSlideIndexByPath(routeManagerPlus.get("path")) !== sceneIndex) {
      routeManagerPlus.gotoSlide(sceneIndex, true);
    }
  };

  const configureShaderTexture = <T extends THREE.Texture>(
    texture: T,
    markNeedsUpdate = true
  ) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    if (markNeedsUpdate) {
      texture.needsUpdate = true;
    }
    return texture;
  };

  const requestVideoFrameOnce = (video: HTMLVideoElement, callback: () => void) => {
    const requestFrame = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      }
    ).requestVideoFrameCallback;

    if (!requestFrame) {
      return false;
    }

    requestFrame.call(video, callback);
    return true;
  };

  const hasRenderableVideoFrame = (video: HTMLVideoElement) =>
    video.dataset.frameReady === "1" &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0;

  const hasRenderableTextureImage = (texture: THREE.Texture) => {
    const image = texture.image as
      | HTMLImageElement
      | HTMLVideoElement
      | HTMLCanvasElement
      | undefined;

    if (!image) return false;

    if (image instanceof HTMLVideoElement) {
      return hasRenderableVideoFrame(image);
    }

    if (image instanceof HTMLImageElement) {
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }

    if (image instanceof HTMLCanvasElement) {
      return image.width > 1 && image.height > 1;
    }

    return false;
  };

  const scheduleRenderableVideoFrame = (
    video: HTMLVideoElement,
    expectedSrc: string,
    onReady?: () => void
  ) => {
    const finish = () => {
      if (video.dataset.src !== expectedSrc || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
      }

      video.dataset.frameReady = "1";
      onReady?.();
    };

    const requestFrame = () => {
      if (video.dataset.frameReady === "1") {
        return;
      }

      if (video.videoWidth <= 0 || video.videoHeight <= 0 || video.readyState < 2) {
        return;
      }

      if (!requestVideoFrameOnce(video, finish)) {
        finish();
      }
    };

    video.addEventListener("loadeddata", requestFrame, { once: true });
    video.addEventListener("canplay", requestFrame, { once: true });
    requestFrame();
  };

  const setPosterOverlayVisible = (visible: boolean, src?: string) => {
    const poster = posterOverlayRef.current;
    if (!poster) return;

    if (src && poster.dataset.posterSrc !== src) {
      const hasCurrentPoster = poster.complete && poster.naturalWidth > 0;

      if (!hasCurrentPoster) {
        poster.dataset.posterSrc = src;
        poster.src = src;
      } else if (poster.dataset.pendingPosterSrc !== src) {
        poster.dataset.pendingPosterSrc = src;
        const nextPoster = new Image();
        nextPoster.decoding = "async";
        nextPoster.onload = () => {
          if (poster.dataset.pendingPosterSrc !== src) return;

          poster.dataset.posterSrc = src;
          poster.src = src;
          delete poster.dataset.pendingPosterSrc;
        };
        nextPoster.src = src;
      }
    }

    const nextOpacity = visible ? "1" : "0";
    if (poster.style.opacity !== nextOpacity) {
      poster.style.opacity = nextOpacity;
    }
  };

  const hideHeroVideoLayer = (video: HTMLVideoElement | null) => {
    if (!video) return;

    video.style.opacity = "0";
    video.style.visibility = "hidden";
    video.style.pointerEvents = "none";
    video.style.willChange = "auto";
  };

  const showHeroVideoLayer = (video: HTMLVideoElement | null) => {
    if (!video) return;

    video.style.visibility = "visible";
    video.style.pointerEvents = "none";
    video.style.willChange = "auto";
  };

  const createPosterTextureSlot = (src: string): SlideTextureSlot | null => {
    const cached = posterTextureCacheRef.current.get(src);

    if (cached?.ready) {
      return {
        image: cached.image!,
        width: cached.width,
        height: cached.height
      };
    }

    if (cached) {
      return null;
    }

    const cachedSlot: PosterTextureCacheEntry = { image: null, width: 1920, height: 1080, ready: false };
    const image = new Image();

    posterTextureCacheRef.current.set(src, cachedSlot);
    image.decoding = "async";
    image.onload = () => {
      cachedSlot.image = image;
      cachedSlot.width = image.naturalWidth || image.width || 1920;
      cachedSlot.height = image.naturalHeight || image.height || 1080;
      cachedSlot.ready = true;
      if (slideShaderRef.current) {
        slideShaderRef.current.pairKey = "";
      }
    };
    image.src = src;

    return null;
  };

  const setVideoElementSource = (
    video: HTMLVideoElement,
    slide: HomeSlide,
    priority: "prev" | "current" | "next"
  ) => {
    if (slide.kind !== "work" || !slide.src) {
      video.pause();
      video.removeAttribute("src");
      video.removeAttribute("data-src");
      video.dataset.frameReady = "0";
      video.poster = slide.poster;
      video.load();
      return false;
    }

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    const shouldWarmFrame = priority === "current" || priority === "next";
    const nextPreload = shouldWarmFrame ? "auto" : "metadata";

    if (video.preload !== nextPreload) {
      video.preload = nextPreload;
    }

    if (video.getAttribute("poster") !== slide.poster) {
      video.poster = slide.poster;
    }

    if (video.dataset.src !== slide.src) {
      if (video === currentVideoRef.current && currentVideoTextureRef.current) {
        currentVideoTextureRef.current.texture.dispose();
        currentVideoTextureRef.current = null;
      }
      video.pause();
      video.dataset.src = slide.src;
      video.dataset.frameReady = "0";
      video.src = slide.src;
      video.load();
      scheduleRenderableVideoFrame(video, slide.src, () => {
        if (priority === "next") {
          video.pause();
        }
        if (slideShaderRef.current) {
          slideShaderRef.current.pairKey = "";
        }
      });
    }

    if (shouldWarmFrame) {
      if (video.paused) {
        video.play().catch(() => undefined);
      }
    } else if (!video.paused) {
      video.pause();
    }

    return true;
  };

  const syncSlidePosterRange = (activeWorkIndex: number) => {
    const total = WORKS.length;
    const prevIndex = modulo(activeWorkIndex - 1, total);
    const currentIndex = modulo(activeWorkIndex, total);
    const nextIndex = modulo(activeWorkIndex + 1, total);

    [prevIndex, currentIndex, nextIndex].forEach((index) => {
      const work = WORKS[index];
      createPosterTextureSlot(work.poster);
    });
  };

  const warmSlidePosterLibrary = () => {
    WORKS.forEach((work) => {
      createPosterTextureSlot(work.poster);
    });
  };

  const disposeSlidePreviewEntry = (index: number) => {
    const entry = slidePreviewEntriesRef.current.get(index);
    if (!entry) return;

    if (entry.countedLoad) {
      entry.countedLoad = false;
      slidePreviewLoadingRef.current = Math.max(0, slidePreviewLoadingRef.current - 1);
    }
    entry.video.pause();
    entry.video.removeAttribute("src");
    entry.video.removeAttribute("data-src");
    entry.video.dataset.frameReady = "0";
    entry.video.load();
    entry.texture?.dispose();
    slidePreviewEntriesRef.current.delete(index);
    scheduleSlidePreviewFlush();
  };

  const scheduleSlidePreviewFlush = () => {
    if (slidePreviewFlushTimerRef.current !== null) return;

    slidePreviewFlushTimerRef.current = window.setTimeout(() => {
      slidePreviewFlushTimerRef.current = null;
      flushSlidePreviewQueue();
    }, 0);
  };

  const markSlidePreviewReady = (entry: SlidePreviewEntry) => {
    const currentEntry = slidePreviewEntriesRef.current.get(entry.index);
    if (
      currentEntry !== entry ||
      !hasRenderableVideoFrame(entry.video)
    ) {
      return;
    }

    entry.state = "ready";
    if (!slidePreviewDesiredRef.current.has(entry.index)) {
      entry.video.pause();
    } else if (slideShaderRef.current) {
      slideShaderRef.current.pairKey = "";
    }
  };

  const loadSlidePreviewEntry = (entry: SlidePreviewEntry) => {
    const video = entry.video;
    let settled = false;
    let timeout = 0;

    const settle = (state: SlidePreviewEntry["state"]) => {
      if (settled) return;

      settled = true;
      window.clearTimeout(timeout);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadeddata", onMediaReady);
      video.removeEventListener("canplay", onMediaReady);
      if (entry.countedLoad) {
        entry.countedLoad = false;
        slidePreviewLoadingRef.current = Math.max(0, slidePreviewLoadingRef.current - 1);
      }

      if (slidePreviewEntriesRef.current.get(entry.index) !== entry) {
        scheduleSlidePreviewFlush();
        return;
      }

      if (state === "ready") {
        markSlidePreviewReady(entry);
      } else {
        entry.state = "error";
        video.pause();
      }

      scheduleSlidePreviewFlush();
    };

    const onError = () => settle("error");
    const onReady = () => settle("ready");
    const onMediaReady = () => {
      if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return;

      video.dataset.frameReady = "1";
      settle("ready");
    };

    entry.state = "loading";
    entry.countedLoad = true;
    slidePreviewLoadingRef.current += 1;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.poster = entry.slide.poster;
    video.dataset.src = entry.src;
    video.dataset.frameReady = "0";
    video.addEventListener("error", onError, { once: true });
    video.addEventListener("loadeddata", onMediaReady, { once: true });
    video.addEventListener("canplay", onMediaReady, { once: true });
    scheduleRenderableVideoFrame(video, entry.src, onReady);
    video.src = entry.src;
    video.load();
    video.play().catch(() => undefined);
    timeout = window.setTimeout(() => {
      onMediaReady();
      if (!settled) {
        settle("error");
      }
    }, 5000);
  };

  const flushSlidePreviewQueue = () => {
    while (
      slidePreviewLoadingRef.current < SLIDE_PREVIEW_MAX_CONNECTIONS &&
      slidePreviewQueueRef.current.length > 0
    ) {
      const index = slidePreviewQueueRef.current.shift();
      if (index === undefined) continue;

      const entry = slidePreviewEntriesRef.current.get(index);
      if (!entry || entry.state !== "queued") continue;

      loadSlidePreviewEntry(entry);
    }
  };

  const queueSlidePreviewEntry = (workIndex: number) => {
    const slide = homeSlides[workIndex + 1] ?? homeSlides[1] ?? openingSlide;
    const src = slide.src;
    if (!src) return;

    const existing = slidePreviewEntriesRef.current.get(workIndex);
    if (existing) {
      if (existing.state === "error" && existing.src !== src) {
        disposeSlidePreviewEntry(workIndex);
      } else {
        return;
      }
    }

    const video = document.createElement("video");
    const entry: SlidePreviewEntry = {
      index: workIndex,
      src,
      slide,
      video,
      texture: null,
      state: "queued",
      countedLoad: false
    };

    slidePreviewEntriesRef.current.set(workIndex, entry);
    slidePreviewQueueRef.current.push(workIndex);
  };

  const requestSlidePreviewRange = (activeWorkIndex: number) => {
    const total = WORKS.length;
    const prevIndex = modulo(activeWorkIndex - 1, total);
    const currentIndex = modulo(activeWorkIndex, total);
    const nextIndex = modulo(activeWorkIndex + 1, total);
    const ordered = [currentIndex, nextIndex, prevIndex];
    const rangeKey = ordered.join(":");

    if (slidePreviewRangeKeyRef.current === rangeKey) return;

    slidePreviewRangeKeyRef.current = rangeKey;
    slidePreviewDesiredRef.current = new Set(ordered);

    ordered.forEach((index) => {
      createPosterTextureSlot(WORKS[index]?.poster ?? heroFrameSrc(currentFrameIndexRef.current));
      queueSlidePreviewEntry(index);
    });

    const desiredQueue = ordered.filter(
      (index) => slidePreviewEntriesRef.current.get(index)?.state === "queued"
    );
    // Tao's _unsetTextures: every player outside the active pair pauses. We keep
    // prev/current/next warm and additionally FREE entries further than one slot
    // beyond that window — without this, a full loop around the 20 works left 20
    // buffered <video> elements + their GPU textures alive (slow VRAM/memory
    // creep that reads as progressive stutter).
    const staleIndices: number[] = [];
    slidePreviewEntriesRef.current.forEach((entry, index) => {
      if (slidePreviewDesiredRef.current.has(index)) return;

      if (!entry.video.paused) {
        entry.video.pause();
      }

      const distance = Math.abs(index - currentIndex);
      if (Math.min(distance, total - distance) > 2) {
        staleIndices.push(index);
      }
    });
    staleIndices.forEach(disposeSlidePreviewEntry);
    slidePreviewQueueRef.current = desiredQueue;

    scheduleSlidePreviewFlush();
  };

  const syncSlidePreviewPlayback = (
    baseWorkIndex: number,
    nextWorkIndex: number,
    rawTransition = 0,
    moving = true
  ) => {
    const playing = new Set<number>();
    const canUseCurrentVideo = (workIndex: number) => {
      const slide = homeSlides[workIndex + 1];
      const currentVideo = currentVideoRef.current;

      // The borrowed grid element (works->slide bridge) already plays this work
      // into the canvas — decoding our preview of the same clip in parallel just
      // burns GPU.
      const shared = sharedSlideVideoRef.current;
      if (
        shared &&
        shared.index === workIndex &&
        !shared.video.paused &&
        shared.video.readyState >= 2
      ) {
        return true;
      }

      return Boolean(
        slide?.kind === "work" &&
        slide.src &&
        currentVideo &&
        currentVideoSrcRef.current === slide.src &&
        hasRenderableVideoFrame(currentVideo)
      );
    };

    if ((moving || rawTransition < 0.92) && !canUseCurrentVideo(baseWorkIndex)) {
      playing.add(baseWorkIndex);
    }

    if ((moving || rawTransition > 0.08) && !canUseCurrentVideo(nextWorkIndex)) {
      playing.add(nextWorkIndex);
    }

    slidePreviewEntriesRef.current.forEach((entry, index) => {
      if (playing.has(index) && entry.state === "ready") {
        if (entry.video.paused) {
          entry.video.play().catch(() => undefined);
        }
        return;
      }

      if (!entry.video.paused) {
        entry.video.pause();
      }
    });
  };

  const pauseSlidePreviewPlayback = () => {
    slidePreviewEntriesRef.current.forEach((entry) => {
      if (!entry.video.paused) {
        entry.video.pause();
      }
    });
  };

  const createSlotFromSlide = (slide: HomeSlide, workIndex: number): SlideTextureSlot | null => {
    const currentVideo = currentVideoRef.current;

    // Video bridge: while this work was just opened from the grid, render the very
    // <video> element the grid zoomed so the frame is identical across the
    // handoff. The release (swap to our own preview) is decided by the handoff
    // monitor in selectWorkFromWorks, which first time-syncs the preview to this
    // element so the swap lands on the same frame and is invisible.
    const shared = sharedSlideVideoRef.current;
    if (shared && shared.index === workIndex && slide.kind === "work") {
      const sv = shared.video;
      const sharedRenderable = sv.readyState >= 2 && sv.videoWidth > 0 && sv.videoHeight > 0;

      if (sharedRenderable) {
        // CRITICAL: the render loop's poster fallback gates the canvas on
        // hasRenderableVideoFrame(), which requires dataset.frameReady === "1" —
        // a hero-only convention the grid's element never gets. Without this flag
        // the loop forces the canvas to opacity 0 and shows the poster THUMB,
        // hiding the whole bridge (and the swap back reads as a screen change).
        // The element played on screen through the zoom, so it provably has frames.
        if (sv.dataset.frameReady !== "1") {
          sv.dataset.frameReady = "1";
        }
        if (!sharedSlideTextureRef.current || sharedSlideTextureRef.current.video !== sv) {
          sharedSlideTextureRef.current?.texture.dispose();
          const texture = configureShaderTexture(new THREE.VideoTexture(sv), false);
          texture.generateMipmaps = false;
          sharedSlideTextureRef.current = { video: sv, texture };
        }
        return {
          image: sv,
          width: sv.videoWidth || 1920,
          height: sv.videoHeight || 1080,
          texture: sharedSlideTextureRef.current.texture
        };
      }
      // Not renderable (clicked without hover / clip not loaded) — fall through to
      // the preview/poster paths below.
    }

    if (
      slide.kind === "work" &&
      slide.src &&
      currentVideo &&
      currentVideoSrcRef.current === slide.src &&
      hasRenderableVideoFrame(currentVideo)
    ) {
      const cached = currentVideoTextureRef.current;

      if (!cached || cached.src !== slide.src || cached.texture.image !== currentVideo) {
        cached?.texture.dispose();
        const texture = configureShaderTexture(new THREE.VideoTexture(currentVideo), false);
        texture.generateMipmaps = false;
        currentVideoTextureRef.current = { src: slide.src, texture };
      }

      const currentTexture = currentVideoTextureRef.current?.texture;
      if (!currentTexture) {
        return null;
      }

      return {
        image: currentVideo,
        width: currentVideo.videoWidth || 1920,
        height: currentVideo.videoHeight || 1080,
        texture: currentTexture
      };
    }

    const previewEntry = slidePreviewEntriesRef.current.get(workIndex);
    const video = previewEntry?.state === "ready" ? previewEntry.video : null;

    if (video && previewEntry && hasRenderableVideoFrame(video)) {
      if (!previewEntry.texture) {
        previewEntry.texture = configureShaderTexture(new THREE.VideoTexture(video), false);
        previewEntry.texture.generateMipmaps = false;
      }

      return {
        image: video,
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
        texture: previewEntry.texture
      };
    }

    return createPosterTextureSlot(slide.poster || heroFrameSrc(currentFrameIndexRef.current));
  };

  const resizeSlideShaderRuntime = () => {
    const runtime = slideShaderRef.current;
    const canvas = transitionCanvasRef.current;
    if (!runtime || !canvas) return;

    const width = Math.max(1, window.innerWidth || canvas.clientWidth || 1);
    const height = Math.max(1, window.innerHeight || canvas.clientHeight || 1);
    const pixelRatio = getShaderPixelRatio();

    if (
      runtime.width === width &&
      runtime.height === height &&
      runtime.pixelRatio === pixelRatio
    ) {
      return;
    }

    runtime.width = width;
    runtime.height = height;
    runtime.pixelRatio = pixelRatio;
    runtime.renderer.setPixelRatio(pixelRatio);
    runtime.renderer.setSize(width, height, false);
    runtime.camera.left = width / -2;
    runtime.camera.right = width / 2;
    runtime.camera.top = height / 2;
    runtime.camera.bottom = height / -2;
    runtime.camera.updateProjectionMatrix();
    runtime.geometry.dispose();
    runtime.geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    runtime.mesh.geometry = runtime.geometry;
    runtime.uniforms.pixels.value.set(width * pixelRatio, height * pixelRatio, 1, 1);
    runtime.pairKey = "";
    runtime.hasRendered = false;
  };

  const initSlideShaderRuntime = () => {
    const canvas = transitionCanvasRef.current;
    if (!canvas || slideShaderRef.current) return slideShaderRef.current;

    const blank1 = configureShaderTexture(createBlankTexture());
    const blank2 = configureShaderTexture(createBlankTexture());
    const uniforms = {
      texture1: { value: blank1 },
      texture2: { value: blank2 },
      uvRate1: { value: new THREE.Vector4(1, 1, 1, 1) },
      uvRate2: { value: new THREE.Vector4(1, 1, 1, 1) },
      progress: { value: 0 },
      mask: { value: new THREE.Vector3(1, 1, 0) },
      translateDelay: { value: new THREE.Vector4(-0.5, 1, 1, 2) },
      accel: { value: new THREE.Vector2(0.5, 2) },
      waveAmpFreq: { value: new THREE.Vector4(0, 0.5, 0, 4) },
      waveSpeedBlend: { value: new THREE.Vector4(0, 0.3, 0.5, 0.5) },
      pixels: { value: new THREE.Vector4(1, 1, 1, 1) },
      velocity: { value: 0 },
      direction: { value: 1 },
      time: { value: new THREE.Vector4(0, 0, 0, 0) }
    };
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1000, 1000);
    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.RawShaderMaterial({
      uniforms,
      vertexShader: taoVideoSlideVertexShader,
      fragmentShader: taoVideoSlideFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    slideShaderRef.current = {
      renderer,
      scene,
      camera,
      geometry,
      mesh,
      material,
      uniforms,
      imageTexture1: blank1,
      imageTexture2: blank2,
      texture1: blank1,
      texture2: blank2,
      pairKey: "",
      width: 1,
      height: 1,
      pixelRatio: 1,
      lastProgress: Number.NaN,
      lastVelocity: Number.NaN,
      lastDirection: Number.NaN,
      lastTexture1Version: -1,
      lastTexture2Version: -1,
      hasRendered: false
    };

    resizeSlideShaderRuntime();
    return slideShaderRef.current;
  };

  const setSlideShaderPair = (baseWorkIndex: number, nextWorkIndex: number) => {
    const runtime = initSlideShaderRuntime();
    if (!runtime) return false;

    const pairKey = `${baseWorkIndex}:${nextWorkIndex}`;
    if (runtime.pairKey === pairKey) return true;

    const baseSlide = homeSlides[baseWorkIndex + 1] ?? homeSlides[1] ?? openingSlide;
    const nextSlide = homeSlides[nextWorkIndex + 1] ?? homeSlides[1] ?? openingSlide;
    const texture1 = createSlotFromSlide(baseSlide, baseWorkIndex);
    let texture2 = createSlotFromSlide(nextSlide, nextWorkIndex);

    // The current slide (texture1) must exist. The NEXT slide may not be decoded
    // yet (e.g. right after a works->video jump). At settle the shader only shows
    // texture1, so fall back to it for texture2 instead of failing the whole pair
    // — failing leaves the canvas with no renderable pair and it goes BLACK during
    // the handoff. The pair rebuilds with the real next clip once it's ready / the
    // user scrolls toward it.
    if (!texture1) {
      return false;
    }
    if (!texture2) {
      texture2 = texture1;
    }

    const bindSlotTexture = (slot: SlideTextureSlot, imageTexture: THREE.Texture) => {
      if (slot.texture) return slot.texture;

      imageTexture.image = slot.image;
      imageTexture.needsUpdate = true;
      return imageTexture;
    };

    runtime.texture1 = bindSlotTexture(texture1, runtime.imageTexture1);
    runtime.texture2 = bindSlotTexture(texture2, runtime.imageTexture2);
    runtime.uniforms.texture1.value = runtime.texture1;
    runtime.uniforms.texture2.value = runtime.texture2;
    runtime.uniforms.uvRate1.value = coverUvRate(
      texture1.width,
      texture1.height,
      runtime.width,
      runtime.height
    );
    runtime.uniforms.uvRate2.value = coverUvRate(
      texture2.width,
      texture2.height,
      runtime.width,
      runtime.height
    );
    runtime.pairKey = pairKey;
    runtime.lastProgress = Number.NaN;
    runtime.lastVelocity = Number.NaN;
    runtime.lastDirection = Number.NaN;
    runtime.lastTexture1Version = -1;
    runtime.lastTexture2Version = -1;
    runtime.hasRendered = false;
    return true;
  };

  const renderSlideShader = (
    progress: number,
    elapsed: number,
    velocity = 0,
    direction = scrollDirectionRef.current
  ) => {
    const runtime = slideShaderRef.current;
    if (!runtime) return;

    const normalizedVelocity = clamp(Math.abs(velocity) / TAO_MAX_SCROLL_IMPULSE, 0, 1);
    const normalizedDirection = direction < 0 ? -1 : 1;
    const shaderStateChanged =
      Math.abs(progress - runtime.lastProgress) > 0.00002 ||
      Math.abs(normalizedVelocity - runtime.lastVelocity) > 0.0005 ||
      normalizedDirection !== runtime.lastDirection;
    const videoFrameChanged =
      runtime.texture1.version !== runtime.lastTexture1Version ||
      runtime.texture2.version !== runtime.lastTexture2Version;
    const transitionIsAlive =
      progress > 0.001 &&
      progress < 0.999 &&
      (normalizedVelocity > 0.002 || shaderStateChanged);
    // Tao Tajima renders the canvas every frame while a video texture is bound, so
    // the quad always re-draws the last valid frame. Skipping renders (our gate
    // below) risks a cleared/black frame at the exact moment a clip loops back to
    // its start — the same black-frame artifact seen in transitions. Keep drawing
    // whenever a live <video> feeds either slot to hold the last frame across the
    // loop seek. Cost is one fullscreen quad; the decode load is unchanged.
    const hasLiveVideoTexture =
      runtime.texture1.image instanceof HTMLVideoElement ||
      runtime.texture2.image instanceof HTMLVideoElement;

    if (
      runtime.hasRendered &&
      !shaderStateChanged &&
      !videoFrameChanged &&
      !transitionIsAlive &&
      !hasLiveVideoTexture
    ) {
      return;
    }

    runtime.uniforms.progress.value = progress;
    runtime.uniforms.velocity.value = normalizedVelocity;
    runtime.uniforms.direction.value = normalizedDirection;
    runtime.uniforms.time.value.y = elapsed;
    runtime.renderer.render(runtime.scene, runtime.camera);
    runtime.lastProgress = progress;
    runtime.lastVelocity = normalizedVelocity;
    runtime.lastDirection = normalizedDirection;
    runtime.lastTexture1Version = runtime.texture1.version;
    runtime.lastTexture2Version = runtime.texture2.version;
    runtime.hasRendered = true;
  };

  const hasRenderableSlideShaderPair = () => {
    const runtime = slideShaderRef.current;
    return Boolean(
      runtime?.pairKey &&
        runtime.hasRendered &&
        Number.isFinite(runtime.lastProgress) &&
        hasRenderableTextureImage(runtime.texture1) &&
        hasRenderableTextureImage(runtime.texture2)
    );
  };

  const scheduleRouteForScene = (sceneIndex: number) => {
    if (routeCommitTimerRef.current !== null) {
      window.clearTimeout(routeCommitTimerRef.current);
    }

    routeCommitTimerRef.current = window.setTimeout(() => {
      setRouteForScene(sceneIndex);
    }, ROUTE_SETTLE_MS);
  };

  const commitActiveScene = (sceneIndex: number, immediateRoute = false) => {
    if (activeSceneRef.current === sceneIndex) return;

    hideCaptionsForSceneChange(sceneIndex);
    activeSceneRef.current = sceneIndex;
    setActiveScene(sceneIndex);

    if (sceneIndex > 0) {
      syncSlidePosterRange(sceneIndex - 1);
    }

    if (immediateRoute) {
      setRouteForScene(sceneIndex);
      return;
    }

    scheduleRouteForScene(sceneIndex);
  };

  const activateScene = (sceneIndex: number, skipAnimation = false) => {
    const boundedScene = Math.max(0, Math.min(homeSlides.length - 1, sceneIndex));
    const clampedScene = !openingAvailableRef.current && boundedScene === 0 ? 1 : boundedScene;

    if (clampedScene > 0 && openingAvailableRef.current) {
      openingAvailableRef.current = false;
      setOpeningAvailable(false);
    }

    if (activeSceneRef.current !== clampedScene) {
      commitActiveScene(clampedScene, skipAnimation);
    }
  };

  const openWorks = () => {
    if (isWorksActive) return;

    clearWorksTimingTimers();
    removeCardOverlay();
    if (sharedSlideVideoRef.current) {
      sharedSlideVideoRef.current.video.pause();
      sharedSlideVideoRef.current = null;
    }
    returnSceneRef.current = activeSceneRef.current;
    setTransitionWorkIndex(clamp(Math.max(1, activeSceneRef.current) - 1, 0, WORKS.length - 1));
    setShouldMountWorks(true);
    setIsListView(false);
    setTransitionFrameSrc(
      activeSceneRef.current === 0
        ? heroFrameSrc(currentFrameIndexRef.current)
        : (homeSlides[activeSceneRef.current]?.poster ?? heroFrameSrc(HERO_FRAME_COUNT))
    );

    if (worksLayerRef.current) {
      gsap.set(worksLayerRef.current, { autoAlpha: 0, pointerEvents: "none" });
      worksLayerRef.current.scrollTo({ top: 0 });
      worksLayerRef.current
        .querySelectorAll<HTMLElement>("#scenes, #scenes > *, [data-work-index]")
        .forEach((el) => {
          el.style.opacity = "";
          el.style.pointerEvents = "";
          el.style.willChange = "";
        });
    }

    setZoomDirection("open");
    setIsWorksView(true);
    setIsZoomingWorks(true);
    routeManagerPlus.goto(WORKS_PATH, null, true);

    scheduleWorksFromClick(() => {
      setWorksEntryKey((key) => key + 1);
    }, WORKS_ENTRY_CARDS_MS);
  };

  const closeWorks = () => {
    if (!isWorksActiveRef.current || isZoomingWorksRef.current) return;

    clearWorksTimingTimers();
    setTransitionWorkIndex(clamp(Math.max(1, returnSceneRef.current) - 1, 0, WORKS.length - 1));
    setZoomDirection("close");
    setIsZoomingWorks(true);
    worksLayerRef.current?.scrollTo({ top: 0 });
  };

  const prepareWorkFromWorks = (workIndex: number) => {
    const targetWorkIndex = clamp(workIndex, 0, WORKS.length - 1);
    const targetScene = targetWorkIndex + 1;
    const targetSlide = homeSlides[targetScene] ?? homeSlides[1] ?? openingSlide;
    const currentVideo = currentVideoRef.current;

    activeTweenRef.current?.kill();
    scrollVelocityRef.current = 0;
    smoothScrollImpulseRef.current = 0;
    smoothWheelDirectionRef.current = 0;
    smoothWheelPulseUntilRef.current = 0;
    touchImpulseRef.current = 0;
    visualVelocityRef.current = 0;
    targetWorkPositionRef.current = targetWorkIndex;
    workPositionRef.current = targetWorkIndex;
    syncSlidePosterRange(targetWorkIndex);
    requestSlidePreviewRange(targetWorkIndex);

    if (currentVideo) {
      setVideoElementSource(currentVideo, targetSlide, "current");
      gsap.set(frameRef.current, { opacity: 0 });
      hideHeroVideoLayer(currentVideo);
    }

    if (setSlideShaderPair(targetWorkIndex, modulo(targetWorkIndex + 1, WORKS.length))) {
      renderSlideShader(0, performance.now() / 1000);
      gsap.set(transitionCanvasRef.current, { opacity: 1 });
      setPosterOverlayVisible(false);
    } else {
      gsap.set(transitionCanvasRef.current, { opacity: 0 });
      setPosterOverlayVisible(true, targetSlide.poster);
    }
  };

  const selectWorkFromWorks = (workIndex: number, sharedVideo?: HTMLVideoElement | null) => {
    const targetWorkIndex = clamp(workIndex, 0, WORKS.length - 1);
    const targetScene = targetWorkIndex + 1;

    clearWorksTimingTimers();
    activeTweenRef.current?.kill();
    scrollVelocityRef.current = 0;
    touchImpulseRef.current = 0;
    visualVelocityRef.current = 0;
    isOpeningSceneRef.current = false;
    openingAvailableRef.current = false;
    setOpeningAvailable(false);
    targetWorkPositionRef.current = targetWorkIndex;
    workPositionRef.current = targetWorkIndex;
    syncSlidePosterRange(targetWorkIndex);
    requestSlidePreviewRange(targetWorkIndex);

    // Bind the grid's just-zoomed <video> as the slide texture for a seamless
    // handoff (identical frames). createSlotFromSlide releases it once our own
    // preview for this work is ready.
    sharedSlideVideoRef.current = sharedVideo
      ? { index: targetWorkIndex, video: sharedVideo }
      : null;

    // Tao shares ONE video player per work between the grid card and the slide
    // (VideoPlayer.list[index]) — clicking never reloads. We mirror that by driving
    // the slide from the hero's preview pool (same clips, warmed on card hover)
    // instead of reloading a separate currentVideo. The <video> element stays
    // hidden/paused; createSlotFromSlide binds the preview VideoTexture, and the
    // pair falls back to texture1 when the next clip isn't ready, so the canvas
    // never blanks to black.
    hideHeroVideoLayer(currentVideoRef.current);
    currentVideoRef.current?.pause();
    currentVideoSrcRef.current = "";

    const renderTargetPair = () => {
      const runtime = slideShaderRef.current;
      if (runtime) {
        runtime.pairKey = "";
      }
      if (setSlideShaderPair(targetWorkIndex, modulo(targetWorkIndex + 1, WORKS.length))) {
        renderSlideShader(0, performance.now() / 1000);
        gsap.set(transitionCanvasRef.current, { opacity: 1 });
        setPosterOverlayVisible(false);
        return true;
      }
      gsap.set(transitionCanvasRef.current, { opacity: 0 });
      setPosterOverlayVisible(true, homeSlides[targetScene]?.poster);
      return false;
    };

    renderTargetPair();

    commitActiveScene(targetScene, true);
    // Tao reveals the slide captions ~0.7s AFTER the slide lands (delay(.7) ->
    // isSlideText in his main.js). Entering on a stable video first and then
    // drawing the captions in separates the two events — without this, video
    // takeover + caption pop landed on the same frame and read as a screen swap.
    // Runs unconditionally: commitActiveScene skips the cycle when re-selecting
    // the work that was already active.
    hideCaptionsForSceneChange(targetScene);
    setIsListView(false);
    setIsZoomingWorks(false);
    setIsWorksView(false);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });

    // Hide the works layer only after the hero canvas frame (just rendered above)
    // has actually been PRESENTED — hiding it in the same task produced a 1-frame
    // black gap on screencast (works layer gone before the canvas composited).
    // During these 2 frames the grid keeps its final zoom frame, which now matches
    // the hero frame exactly (same video element, same scale, full brightness).
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        gsap.set(worksLayerRef.current, { autoAlpha: 0, pointerEvents: "none" });
        worksLayerRef.current?.scrollTo({ top: 0 });
      });
    });

    const getReadyPreviewVideo = () => {
      const entry = slidePreviewEntriesRef.current.get(targetWorkIndex);
      return entry?.state === "ready" && hasRenderableVideoFrame(entry.video)
        ? entry.video
        : null;
    };

    const sharedIsRenderable = () => {
      const shared = sharedSlideVideoRef.current;
      const sv = shared?.index === targetWorkIndex ? shared.video : null;
      return Boolean(
        sv && sv.readyState >= 2 && sv.videoWidth > 0 && sv.videoHeight > 0 && !sv.paused
      );
    };

    const handToPreview = () => {
      sharedSlideVideoRef.current = null;
      const runtime = slideShaderRef.current;
      if (runtime) {
        runtime.pairKey = "";
      }
    };

    // NO swap while the slide is on screen. The borrowed grid element IS the slide
    // texture for as long as the user stays on this work — exactly Tao's shared
    // VideoPlayer (one element per work for both list and slide). Any mid-settle
    // texture swap to our preview produced a visible time-jump (captured on
    // screencast: the clip jumped ~0.2s when the swap landed). Release + pause
    // only when the user leaves the slide; if the element somehow stops, fall
    // back to the preview then (a transition will cover that rebuild).
    const monitorHandoff = () => {
      const shared = sharedSlideVideoRef.current;
      if (!shared || shared.index !== targetWorkIndex) {
        return;
      }

      if (activeSceneRef.current !== targetScene) {
        shared.video.pause();
        handToPreview();
        return;
      }

      if (shared.video.paused || shared.video.ended) {
        handToPreview();
        return;
      }

      window.requestAnimationFrame(monitorHandoff);
    };

    // Phase 1 — reveal: dissolve the card overlay as soon as the canvas is painting
    // something MOVING (the borrowed grid video, or our preview). Short fallback so
    // the card never sticks.
    const revealStartedAt = performance.now();
    const revealWhenReady = () => {
      if (activeSceneRef.current !== targetScene) {
        return;
      }

      if (
        sharedIsRenderable() ||
        getReadyPreviewVideo() ||
        performance.now() - revealStartedAt >= 1200
      ) {
        renderTargetPair();
        dissolveCard(360);
        monitorHandoff();
        return;
      }

      window.requestAnimationFrame(revealWhenReady);
    };

    revealWhenReady();
  };

  const completeWorksZoom = () => {
    clearWorksTimingTimers();
    setIsZoomingWorks(false);

    if (zoomDirection === "close") {
      setIsWorksView(false);
      setRouteForScene(returnSceneRef.current);
      // Back on the slide: reveal its caption on the same 0.7s debounce as any
      // other landing (isWorksActiveRef flips before the timer fires).
      syncCaptionRevealOffsets();
      restartCaptionRevealTimer();
    }
  };

  useEffect(() => clearWorksTimingTimers, []);

  useEffect(() => {
    if (!isWorksActive) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isWorksActive]);

  useEffect(() => {
    const section = sectionRef.current;
    const frame = frameRef.current;
    const canvas = transitionCanvasRef.current;

    if (!section || !frame || !canvas) return;

    let lastFrame = 1;
    const startedAt = performance.now();
    let lastTick = startedAt;
    const openingAvailableOnLoad = getOpeningAvailableOnLoad();
    const initialScene = initialSceneFromPath();
    const initialWorkScene = Math.max(1, initialScene);
    const initialWorkIndex = clamp(initialWorkScene - 1, 0, WORKS.length - 1);
    const startInList = window.location.pathname === WORKS_PATH;
    const startInOpening = openingAvailableOnLoad && initialScene === 0 && !startInList;

    openingAvailableRef.current = startInOpening;
    isOpeningSceneRef.current = startInOpening;
    openingProgressRef.current = startInOpening ? 0 : 1;
    targetWorkPositionRef.current = initialWorkIndex;
    workPositionRef.current = initialWorkIndex;
    activeSceneRef.current = startInOpening ? 0 : initialWorkScene;
    setOpeningAvailable(startInOpening);
    setActiveScene(startInOpening ? 0 : initialWorkScene);
    captionSceneRef.current = activeSceneRef.current;
    setCaptionScene(activeSceneRef.current);
    syncCaptionRevealOffsets();

    try {
      window.localStorage.setItem(OPENING_SEEN_KEY, "1");
    } catch {
      // localStorage can be blocked in private browsing; the in-memory flag still keeps this load correct.
    }

    gsap.set(section, { opacity: 0 });
    gsap.to(section, {
      opacity: 1,
      duration: 0.55,
        ease: "power1.out",
        delay: 0.05
      });

    initSlideShaderRuntime();
    resizeSlideShaderRuntime();
    warmSlidePosterLibrary();
    requestSlidePreviewRange(initialWorkIndex);

    const setFrame = (frameNumber: number) => {
      const nextFrame = Math.max(1, Math.min(HERO_FRAME_COUNT, Math.round(frameNumber)));
      if (nextFrame === lastFrame) return;

      lastFrame = nextFrame;
      currentFrameIndexRef.current = nextFrame;
      frame.src = heroFrameSrc(nextFrame);
    };

    const setLoopOpacity = (element: HTMLElement | null, opacity: 0 | 1) => {
      if (!element) return;

      const value = String(opacity);
      if (element.style.opacity !== value) {
        element.style.opacity = value;
      }
    };

    const finishOpening = () => {
      if (!isOpeningSceneRef.current) return;

      hideSceneCaptions();
      isOpeningSceneRef.current = false;
      openingAvailableRef.current = false;
      setOpeningAvailable(false);
      openingProgressRef.current = 1;
      targetWorkPositionRef.current = 0;
      workPositionRef.current = 0;
      scrollVelocityRef.current = Math.max(scrollVelocityRef.current, 0.018);
      gsap.set(frame, { opacity: 0 });
      gsap.set(canvas, { opacity: 1 });
      commitActiveScene(1);
    };

    const updateOpening = (frameScale: number) => {
      openingProgressRef.current = clamp(
        openingProgressRef.current + openingVelocityRef.current * frameScale,
        0,
        1.02
      );
      openingVelocityRef.current *= Math.pow(OPENING_VELOCITY_DECAY, frameScale);

      const progress = clamp(openingProgressRef.current, 0, 1);
      if (progress > 0.035) {
        dismissCaptions();
      }
      setFrame(1 + smoothStep(0, 0.88, progress) * (HERO_FRAME_COUNT - 1));
      gsap.set(frame, {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        clipPath: "inset(0%)"
      });
      gsap.set(canvas, { opacity: 0 });

      if (openingProgressRef.current >= 1) {
        finishOpening();
      }
    };

    const updateWorksLoop = (frameScale: number, elapsed: number, now: number) => {
      if (isWorksActiveRef.current) {
        pauseSlidePreviewPlayback();
        return;
      }

      const hasTargetTween = Boolean(activeTweenRef.current?.isActive());

      if (hasTargetTween) {
        scrollVelocityRef.current = 0;
        smoothScrollImpulseRef.current = 0;
        smoothWheelDirectionRef.current = 0;
        smoothWheelPulseUntilRef.current = 0;
        touchImpulseRef.current = 0;
      } else {
        if (now < smoothWheelPulseUntilRef.current) {
          smoothScrollImpulseRef.current +=
            smoothWheelDirectionRef.current * TAO_SMOOTH_SCROLL_FORCE * frameScale;
        }

        smoothScrollImpulseRef.current = clamp(
          smoothScrollImpulseRef.current,
          -TAO_SMOOTH_SCROLL_LIMIT,
          TAO_SMOOTH_SCROLL_LIMIT
        );
        scrollVelocityRef.current = clamp(
          scrollVelocityRef.current +
            smoothScrollImpulseRef.current * frameScale +
            touchImpulseRef.current * frameScale,
          -TAO_MAX_SCROLL_IMPULSE,
          TAO_MAX_SCROLL_IMPULSE
        );
        targetWorkPositionRef.current += scrollVelocityRef.current;
        smoothScrollImpulseRef.current *= TAO_SMOOTH_SCROLL_DECAY;
        touchImpulseRef.current *= TAO_TOUCH_DECAY;
        scrollVelocityRef.current *= TAO_WHEEL_DECAY;

        const canSnap =
          now - lastScrollInputAtRef.current > SCROLL_SNAP_IDLE_MS &&
          Math.abs(smoothScrollImpulseRef.current) < TAO_SNAP_THRESHOLD &&
          Math.abs(scrollVelocityRef.current) < TAO_SNAP_THRESHOLD &&
          Math.abs(touchImpulseRef.current) < TAO_SNAP_THRESHOLD;

        if (canSnap) {
          const nearest = Math.round(targetWorkPositionRef.current);
          const distance = nearest - targetWorkPositionRef.current;
          targetWorkPositionRef.current +=
            Math.sin(distance * Math.PI * 0.5) * TAO_SNAP_FORCE * frameScale;
        }

        const settleTarget = Math.round(targetWorkPositionRef.current);
        if (
          canSnap &&
          Math.abs(settleTarget - targetWorkPositionRef.current) < TAO_SETTLE_EPSILON
        ) {
          targetWorkPositionRef.current = settleTarget;
          scrollVelocityRef.current = 0;
          smoothScrollImpulseRef.current = 0;
          touchImpulseRef.current = 0;
        }
      }

      const previousVisualPosition = workPositionRef.current;
      const targetDistance = targetWorkPositionRef.current - previousVisualPosition;
      if (hasTargetTween) {
        const response = clamp(
          VISUAL_PROGRESS_RESPONSE_MIN +
            Math.abs(targetDistance) * 0.2 +
            0.08,
          VISUAL_PROGRESS_RESPONSE_MIN,
          VISUAL_PROGRESS_RESPONSE_MAX
        );
        const responsePerFrame = 1 - Math.pow(1 - response, frameScale);

        workPositionRef.current += targetDistance * responsePerFrame;
      } else {
        // Tao integrates wheel/touch inertia directly into the rendered slide
        // position. A second visual lerp here makes the WebGL transition late.
        workPositionRef.current = targetWorkPositionRef.current;
      }

      const visualDelta = workPositionRef.current - previousVisualPosition;
      const velocityBlend = clamp(VISUAL_VELOCITY_RESPONSE * frameScale, 0.12, 0.72);
      visualVelocityRef.current += (visualDelta - visualVelocityRef.current) * velocityBlend;

      if (Math.abs(visualDelta) > 0.00005) {
        scrollDirectionRef.current = visualDelta < 0 ? -1 : 1;
      }

      if (
        Math.abs(targetWorkPositionRef.current - workPositionRef.current) < TAO_SETTLE_EPSILON &&
        Math.abs(smoothScrollImpulseRef.current) < TAO_SNAP_THRESHOLD &&
        Math.abs(scrollVelocityRef.current) < TAO_SNAP_THRESHOLD &&
        Math.abs(touchImpulseRef.current) < TAO_SNAP_THRESHOLD
      ) {
        workPositionRef.current = targetWorkPositionRef.current;
        visualVelocityRef.current *= 0.5;
      }

      const wrapped = modulo(workPositionRef.current, WORKS.length);
      const baseWorkIndex = Math.floor(wrapped);
      const nextWorkIndex = modulo(baseWorkIndex + 1, WORKS.length);
      const rawTransition = wrapped - baseWorkIndex;
      const visualTransition = rawTransition;
      const activeWorkIndex = rawTransition < 0.5 ? baseWorkIndex : nextWorkIndex;
      const activeSlide = homeSlides[activeWorkIndex + 1] ?? homeSlides[1] ?? openingSlide;
      const transitionIsMoving =
        hasTargetTween ||
        Math.abs(targetDistance) > TAO_SETTLE_EPSILON ||
        Math.abs(visualDelta) > 0.00005 ||
        Math.abs(scrollVelocityRef.current) > TAO_SNAP_THRESHOLD ||
        Math.abs(touchImpulseRef.current) > TAO_SNAP_THRESHOLD;
      // Captions are NOT driven by per-frame progress. Tao's rule: they hide when
      // the slide index changes (midpoint crossing — handled by commitActiveScene
      // below) and reappear on the 0.7s debounce timer. Mapping caption opacity to
      // rawTransition here is what made two captions overlap mid-scroll and
      // strobe near the reveal thresholds.
      requestSlidePreviewRange(activeWorkIndex);
      syncSlidePreviewPlayback(
        baseWorkIndex,
        nextWorkIndex,
        rawTransition,
        transitionIsMoving
      );
      const pairReady = setSlideShaderPair(baseWorkIndex, nextWorkIndex);
      if (pairReady) {
        renderSlideShader(
          visualTransition,
          elapsed,
          visualVelocityRef.current,
          scrollDirectionRef.current
        );
      }
      const canHoldPreviousPair = hasRenderableSlideShaderPair();
      const needsPosterFallback =
        activeSlide.kind === "work" && !canHoldPreviousPair;
      let needsMediaFallback = needsPosterFallback;
      setLoopOpacity(frame, 0);
      setLoopOpacity(canvas, canHoldPreviousPair && !needsPosterFallback ? 1 : 0);
      if (canHoldPreviousPair) {
        // Tao Tajima renders every slide — including the settled, playing video —
        // INSIDE the WebGL canvas and never swaps to a raw DOM <video>. Matching
        // that removes the perceptible "photo -> video" handoff. At settle the
        // shader sits at progress 0 = clean cover frame, so the liquid deformation
        // (only active mid-transition) is untouched and there is no swap to see.
        const currentVideo = currentVideoRef.current;
        const settledOnWork =
          !transitionIsMoving &&
          rawTransition < TAO_SETTLE_EPSILON &&
          activeSlide.kind === "work";

        if (
          settledOnWork &&
          currentVideo &&
          currentVideoSrcRef.current === activeSlide.src &&
          hasRenderableVideoFrame(currentVideo)
        ) {
          // Work opened from the grid: the warmed currentVideo already holds this
          // exact clip. Keep it PLAYING but visually invisible (opacity 0, still
          // decoding) so it feeds the canvas VideoTexture — the render stays in
          // WebGL, with no reload and no poster step. createSlotFromSlide binds
          // this same <video> because currentVideoSrcRef matches the slide.
          currentVideo.style.visibility = "visible";
          currentVideo.style.opacity = "0";
          currentVideo.style.pointerEvents = "none";
          if (currentVideo.paused) {
            currentVideo.play().catch(() => undefined);
          }
        } else {
          // Scrolling, or a stale binding: hide the <video> and let the canvas run
          // off the playing slide-preview texture instead.
          hideHeroVideoLayer(currentVideo);
          currentVideo?.pause();
          if (currentVideoSrcRef.current) {
            currentVideoSrcRef.current = "";
            const runtime = slideShaderRef.current;
            if (runtime) {
              runtime.pairKey = "";
            }
          }
        }
      }
      if (needsMediaFallback) {
        setLoopOpacity(canvas, 0);
      }
      setPosterOverlayVisible(needsMediaFallback, activeSlide.poster);

      if (activeSceneRef.current !== activeWorkIndex + 1) {
        commitActiveScene(activeWorkIndex + 1);
      }
    };

    const animate = () => {
      const now = performance.now();
      const elapsed = (now - startedAt) / 1000;
      const frameScale = clamp(((now - lastTick) / 1000) * 60, 0.35, 2.4);
      lastTick = now;

      if (isOpeningSceneRef.current) {
        updateOpening(frameScale);
      } else {
        updateWorksLoop(frameScale, elapsed, now);
      }

      slideRafRef.current = window.requestAnimationFrame(animate);
    };

    const addScrollForce = (amount: number) => {
      if (isWorksActiveRef.current) return;

      if (isOpeningSceneRef.current) {
        openingVelocityRef.current = clamp(
          openingVelocityRef.current + amount * WHEEL_FORCE * 1.65,
          -OPENING_MAX_SCROLL_VELOCITY,
          OPENING_MAX_SCROLL_VELOCITY
        );
        return;
      }

      activeTweenRef.current?.kill();
      lastScrollInputAtRef.current = performance.now();
      if (Math.abs(amount) > 0.0001) {
        scrollDirectionRef.current = amount < 0 ? -1 : 1;
      }
      scrollVelocityRef.current = clamp(
        scrollVelocityRef.current + amount * WHEEL_FORCE,
        -TAO_MAX_SCROLL_IMPULSE,
        TAO_MAX_SCROLL_IMPULSE
      );
    };

    const addSmoothWheelPulse = (amount: number) => {
      if (isWorksActiveRef.current || isOpeningSceneRef.current) return;

      const direction = Math.sign(amount);
      if (direction === 0) return;

      activeTweenRef.current?.kill();
      lastScrollInputAtRef.current = performance.now();
      scrollDirectionRef.current = direction < 0 ? -1 : 1;
      smoothWheelDirectionRef.current = direction;
      smoothWheelPulseUntilRef.current =
        lastScrollInputAtRef.current + TAO_SMOOTH_WHEEL_MS;
    };

    const addTouchImpulse = (delta: number) => {
      if (isWorksActiveRef.current || isOpeningSceneRef.current) return;

      activeTweenRef.current?.kill();
      lastScrollInputAtRef.current = performance.now();
      if (Math.abs(delta) > 0.0001) {
        scrollDirectionRef.current = delta > 0 ? -1 : 1;
      }
      touchImpulseRef.current = clamp(
        touchImpulseRef.current - delta * TOUCH_FORCE,
        -TAO_MAX_SCROLL_IMPULSE,
        TAO_MAX_SCROLL_IMPULSE
      );
    };

    const onWheel = (event: WheelEvent) => {
      if (isWorksActiveRef.current) return;

      event.preventDefault();
      const wheelAmount = normalizeWheelAmount(event);

      if (!isOpeningSceneRef.current && shouldUseTaoSmoothWheelPath()) {
        addSmoothWheelPulse(wheelAmount);
        return;
      }

      addScrollForce(wheelAmount);
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchPointRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (isWorksActiveRef.current) return;

      const touch = event.touches[0];
      if (!touch || touchPointRef.current === null) return;

      event.preventDefault();
      addTouchImpulse(touch.clientX - touchPointRef.current.x + touch.clientY - touchPointRef.current.y);
      touchPointRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isWorksActiveRef.current) return;

      if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        addScrollForce(KEY_FORCE / WHEEL_FORCE);
      }

      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        addScrollForce(-KEY_FORCE / WHEEL_FORCE);
      }
    };

    if (startInOpening) {
      setFrame(1);
      gsap.set(frame, { opacity: 1 });
      gsap.set(canvas, { opacity: 0 });
      setRouteForScene(0);
    } else {
      gsap.set(frame, { opacity: 0 });
      syncSlidePosterRange(initialWorkIndex);
      if (setSlideShaderPair(initialWorkIndex, modulo(initialWorkIndex + 1, WORKS.length))) {
        renderSlideShader(0, 0);
        gsap.set(canvas, { opacity: 1 });
        setPosterOverlayVisible(false);
      } else {
        gsap.set(canvas, { opacity: 0 });
        setPosterOverlayVisible(true, homeSlides[initialWorkIndex + 1]?.poster);
      }
      if (!startInList) {
        setRouteForScene(initialWorkIndex + 1);
      }
    }

    if (startInList) {
      if (worksLayerRef.current) {
        gsap.set(worksLayerRef.current, { autoAlpha: 1, pointerEvents: "auto" });
      }
      setShouldMountWorks(true);
      setIsWorksView(true);
      setWorksEntryKey((key) => key + 1);
    }

    window.addEventListener("resize", resizeSlideShaderRuntime);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    slideRafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (slideRafRef.current !== null) {
        window.cancelAnimationFrame(slideRafRef.current);
      }

      window.removeEventListener("resize", resizeSlideShaderRuntime);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      activeTweenRef.current?.kill();
      if (routeCommitTimerRef.current !== null) {
        window.clearTimeout(routeCommitTimerRef.current);
      }
      if (captionRevealTimerRef.current !== null) {
        window.clearTimeout(captionRevealTimerRef.current);
        captionRevealTimerRef.current = null;
      }
      currentVideoRef.current?.pause();
      currentVideoTextureRef.current?.texture.dispose();
      currentVideoTextureRef.current = null;
      slidePreviewQueueRef.current = [];
      slidePreviewDesiredRef.current.clear();
      Array.from(slidePreviewEntriesRef.current.keys()).forEach(disposeSlidePreviewEntry);
      if (slidePreviewFlushTimerRef.current !== null) {
        window.clearTimeout(slidePreviewFlushTimerRef.current);
        slidePreviewFlushTimerRef.current = null;
      }
      const runtime = slideShaderRef.current;

      if (runtime) {
        runtime.imageTexture1.dispose();
        runtime.imageTexture2.dispose();
        runtime.renderer.dispose();
        runtime.geometry.dispose();
        runtime.material.dispose();
        slideShaderRef.current = null;
      }

      posterTextureCacheRef.current.clear();
      removeCardOverlay();
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = routeManagerPlus.get("path");
      const routeScene = routeManagerPlus.getSlideIndexByPath(path);

      if (path === WORKS_PATH && !isWorksView) {
        clearWorksTimingTimers();
        removeCardOverlay();
        setShouldMountWorks(true);
        setIsListView(false);
        setIsZoomingWorks(false);
        setIsWorksView(true);
        worksLayerRef.current?.scrollTo({ top: 0 });
        gsap.set(worksLayerRef.current, { autoAlpha: 1, pointerEvents: "auto" });
        worksLayerRef.current
          ?.querySelectorAll<HTMLElement>("#scenes, #scenes > *, [data-work-index]")
          .forEach((el) => {
            el.style.opacity = "";
            el.style.pointerEvents = "";
            el.style.willChange = "";
          });
        setWorksEntryKey((key) => key + 1);
        return;
      }

      if (path !== WORKS_PATH && isWorksView) {
        setZoomDirection("close");
        setIsZoomingWorks(true);
        return;
      }

      if (routeScene >= 0 && !isWorksView && !isZoomingWorks) {
        scrollToScene(routeScene, "auto");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isWorksView, isZoomingWorks]);

  const scrollToScene = (sceneIndex: number, behavior: ScrollBehavior = "smooth") => {
    const boundedScene = Math.max(0, Math.min(homeSlides.length - 1, sceneIndex));
    const targetScene = !openingAvailableRef.current && boundedScene === 0 ? 1 : boundedScene;

    if (targetScene <= 0) {
      isOpeningSceneRef.current = true;
      openingAvailableRef.current = true;
      setOpeningAvailable(true);
      openingProgressRef.current = 0;
      openingVelocityRef.current = 0;
      commitActiveScene(0, true);
      return;
    }

    isOpeningSceneRef.current = false;
    openingAvailableRef.current = false;
    setOpeningAvailable(false);

    const targetWorkIndex = targetScene - 1;
    const targetPosition = nearestLoopTarget(
      targetWorkPositionRef.current,
      targetWorkIndex,
      WORKS.length
    );
    const targetDelta = targetPosition - workPositionRef.current;

    activeTweenRef.current?.kill();
    if (Math.abs(targetDelta) > 0.0001) {
      scrollDirectionRef.current = targetDelta < 0 ? -1 : 1;
    }

    if (behavior === "auto") {
      targetWorkPositionRef.current = targetPosition;
      workPositionRef.current = targetPosition;
      scrollVelocityRef.current = 0;
      smoothScrollImpulseRef.current = 0;
      smoothWheelDirectionRef.current = 0;
      smoothWheelPulseUntilRef.current = 0;
      touchImpulseRef.current = 0;
      visualVelocityRef.current = 0;
      commitActiveScene(targetScene, true);
      syncSlidePosterRange(targetWorkIndex);
    } else {
      activeTweenRef.current = gsap.to(targetWorkPositionRef, {
        current: targetPosition,
        duration: 0.72,
        ease: "sine.out",
        onStart: () => {
          scrollVelocityRef.current = 0;
          smoothScrollImpulseRef.current = 0;
          smoothWheelDirectionRef.current = 0;
          smoothWheelPulseUntilRef.current = 0;
          touchImpulseRef.current = 0;
          lastScrollInputAtRef.current = performance.now();
        },
        onComplete: () => {
          commitActiveScene(targetScene, true);
        }
      });
    }

    setIsListView(false);
  };

  const handleVideoClick = (event?: ReactMouseEvent<HTMLElement>) => {
    if (isListView || isWorksActive) return;

    void event;
    scrollToScene(nextSceneIndex);
  };

  const handleVideoKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    handleVideoClick();
  };

  return (
    <section
      ref={sectionRef}
      id="home"
      data-no-trail
      className="relative overflow-hidden bg-black"
      style={{ minHeight: `${LOOP_SCROLL_DVH}dvh` }}
    >
      <div className="sticky top-0 min-h-[100dvh] overflow-hidden bg-black">
        <div
          ref={worksLayerRef}
          className={clsx(
            "flor-no-scrollbar fixed left-0 top-0 z-40 h-[100dvh] w-screen overflow-y-auto bg-white opacity-0",
            isWorksActive ? "pointer-events-auto" : "pointer-events-none"
          )}
          aria-hidden={!isWorksActive}
        >
          {shouldMountWorks && (
            <CenasGridSection
              onHomeClick={closeWorks}
              onWorkIntent={prepareWorkFromWorks}
              onWorkSelect={selectWorkFromWorks}
              scrollRootRef={worksLayerRef}
              entryKey={worksEntryKey}
              entryMode="manual"
            />
          )}
        </div>

        <WorksZoomTransition
          active={isZoomingWorks}
          direction={zoomDirection}
          sourceImageSrc={transitionFrameSrc}
          sourceVideoRef={currentVideoRef}
          sourceVideoSrc={currentScene.kind === "work" ? currentScene.src : ""}
          targetWorkIndex={transitionWorkIndex}
          worksLayerRef={worksLayerRef}
          onComplete={completeWorksZoom}
        />

        <button
          type="button"
          aria-label="Avancar cena"
          tabIndex={isListView || isWorksActive ? -1 : 0}
          onClick={handleVideoClick}
          onKeyDown={handleVideoKeyDown}
          className={clsx(
            "absolute inset-0 z-[3] block h-full w-full appearance-none border-0 bg-transparent p-0",
            isListView || isWorksActive ? "pointer-events-none" : "cursor-pointer"
          )}
        >
          <img
            ref={frameRef}
            src={heroFrameSrc(1)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
          />
          <video
            ref={currentVideoRef}
            data-hero-video="current"
            className="pointer-events-none invisible absolute inset-0 h-full w-full object-cover opacity-0"
            autoPlay={false}
            loop
            muted
            playsInline
            preload="metadata"
          />
        </button>

        <canvas
          ref={transitionCanvasRef}
          aria-hidden="true"
          data-transition-canvas
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full opacity-0"
        />

        <img
          ref={posterOverlayRef}
          src={currentScene.poster || heroFrameSrc(1)}
          alt=""
          className="pointer-events-none absolute inset-0 z-[4] h-full w-full object-cover opacity-0 transition-opacity duration-150 ease-out"
        />

        <div className="pointer-events-none absolute inset-0 z-[90]">
          <div
            className={clsx(
              "absolute inset-0 transition-colors duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isListView ? "bg-[#f2ede5]/90 backdrop-blur-[6px]" : "bg-transparent"
            )}
          />

          <div
            className={clsx(
              "flex items-start justify-between px-6 pb-0 pt-6 text-[11px] uppercase tracking-[0.42em] md:px-10 md:pt-8",
              chromeTone
            )}
          >
            <a
              href="#home"
              onClick={(event) => {
                if (!isWorksActiveRef.current && window.location.pathname !== WORKS_PATH) return;
                event.preventDefault();
                closeWorks();
              }}
              className="pointer-events-auto inline-flex items-center gap-3 whitespace-nowrap transition-opacity duration-500 hover:opacity-70"
            >
              <span className="tracking-[0.35em]">Home</span>
              <span className={clsx("h-px w-10 transition-colors duration-500", lineTone)} />
            </a>

            <div className="pointer-events-auto flex items-center gap-3 whitespace-nowrap transition-opacity duration-500">
              <a
                href="https://github.com/alanvareschini"
                target="_blank"
                rel="noreferrer"
                className="transition-opacity duration-300 hover:opacity-100"
              >
                GitHub
              </a>
              <span>/</span>
              <a
                href="https://vimeo.com"
                target="_blank"
                rel="noreferrer"
                className="transition-opacity duration-300 hover:opacity-100"
              >
                Vimeo
              </a>
            </div>
          </div>

          <div className="flex min-h-[calc(100dvh-9rem)] items-center px-6 md:px-10">
            <div className="pointer-events-none flex w-full items-center justify-between">
              <div className="relative h-16 w-16 pointer-events-auto md:h-20 md:w-20">
                <div className={clsx("menuTrigger", isListView || isWorksActive ? "is-list" : "is-slide")}>
                  <button
                    type="button"
                    id="menuTrigger_open"
                    aria-label="Abrir works"
                    onClick={openWorks}
                    className="menuTrigger_open menu-trigger-open"
                  >
                    <span />
                    <span />
                    <span />
                  </button>

                  <button
                    type="button"
                    id="menuTrigger_close"
                    aria-label="Fechar menu"
                    onClick={() => {
                      if (isWorksActive) {
                        closeWorks();
                        return;
                      }

                      setIsListView(false);
                    }}
                    className="menuTrigger_close menu-trigger-close"
                  >
                    <span />
                    <span />
                  </button>
                </div>
              </div>

              <div
                ref={captionLayerRef}
                className={clsx(
                  "flor-caption-sync-layer w-[min(92vw,1120px)] max-w-none",
                  (isListView || isWorksActive) && "flor-caption-sync-hidden text-[#171411]",
                  !isListView && !isWorksActive && !captionsVisible && "flor-caption-sync-suppressed",
                  !isListView && !isWorksActive && captionsVisible && "flor-caption-sync-ready text-white"
                )}
              >
                {/* Exit panel: the caption that was on screen, playing Tao's 0.5s
                    slide-out. Keyed so a fresh mount restarts the animation. */}
                {captionExitScene !== null && (
                  <div key={`caption-exit-${captionExitScene}`} className="contents">
                    {renderCaptionScene(homeSlides[captionExitScene] ?? currentScene, "exit")}
                  </div>
                )}
                {/* Show panel: the settled slide's caption. Hidden until the layer
                    turns -ready (0.7s debounce), then plays Tao's staggered
                    slide-in. Keyed per scene so the entrance re-fires per slide. */}
                <div key={`caption-show-${captionScene}`} className="contents">
                  {renderCaptionScene(homeSlides[captionScene] ?? currentScene, "show")}
                </div>
              </div>

              <div className="hidden h-14 w-14 md:block" />
            </div>
          </div>

          <div
            className={clsx(
              "absolute inset-x-0 bottom-6 px-6 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] md:bottom-8 md:px-10",
              isListView || isWorksActive ? "translate-y-12 opacity-0" : "translate-y-0 opacity-100"
            )}
          >
            <div className="relative mx-auto max-w-[1120px] text-white">
              <div
                className={clsx(
                  "flor-bottom-caption-chrome absolute left-0 right-0 top-[2.7rem] h-px bg-white/72 md:top-[3rem]",
                  !captionsVisible && "flor-bottom-caption-hidden"
                )}
              />
              <span
                className={clsx(
                  "flor-bottom-caption-chrome absolute left-0 top-[2.7rem] h-0 w-0 -translate-y-1/2 border-b-[5px] border-r-[18px] border-t-[5px] border-b-transparent border-r-white/78 border-t-transparent md:top-[3rem]",
                  !captionsVisible && "flor-bottom-caption-hidden"
                )}
              />
              <span
                className={clsx(
                  "flor-bottom-caption-chrome absolute right-0 top-[2.7rem] h-0 w-0 -translate-y-1/2 border-b-[5px] border-l-[18px] border-t-[5px] border-b-transparent border-l-white/78 border-t-transparent md:top-[3rem]",
                  !captionsVisible && "flor-bottom-caption-hidden"
                )}
              />

              <div className="grid grid-cols-[1fr,auto,1fr] items-start gap-4 md:gap-8">
                <button
                  type="button"
                  onClick={() => scrollToScene(previousSceneIndex)}
                  className={clsx(
                    "flor-bottom-caption-side pointer-events-auto justify-self-start text-left",
                    !captionsVisible && "flor-bottom-caption-hidden"
                  )}
                >
                  <p className="font-mono text-[13px] tracking-[0.16em] text-white/52 md:text-[14px]">
                    #{previousScene.id}
                  </p>
                  <p
                    className={clsx(
                      "flor-bottom-caption-gradient mt-1 text-[0.95rem] font-semibold italic tracking-[0.05em] text-white/95 md:text-[1.6rem]",
                      !captionsVisible && "flor-bottom-caption-hidden"
                    )}
                    style={getCaptionGradientStyle(currentScene)}
                  >
                    {previousScene.title}
                  </p>
                </button>

                <div className="justify-self-center text-center">
                  <p className="font-mono text-[13px] tracking-[0.28em] text-white/95 md:text-[14px]">
                    {String(visibleSceneNumber).padStart(2, "0")}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.36em] text-white/55">
                    / {String(visibleSceneTotal).padStart(2, "0")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => scrollToScene(nextSceneIndex)}
                  className={clsx(
                    "flor-bottom-caption-side pointer-events-auto justify-self-end text-right",
                    !captionsVisible && "flor-bottom-caption-hidden"
                  )}
                >
                  <p className="font-mono text-[13px] tracking-[0.16em] text-white/92 md:text-[14px]">
                    #{nextScene.id}
                  </p>
                  <p
                    className={clsx(
                      "flor-bottom-caption-gradient mt-1 text-[0.95rem] font-semibold italic tracking-[0.05em] text-white md:text-[1.6rem]",
                      !captionsVisible && "flor-bottom-caption-hidden"
                    )}
                    style={getCaptionGradientStyle(currentScene)}
                  >
                    {nextScene.title}
                  </p>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
