"use client";

import clsx from "clsx";
import {
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
const VISUAL_PROGRESS_RESPONSE_MIN = 0.32;
const VISUAL_PROGRESS_RESPONSE_MAX = 0.68;
const VISUAL_VELOCITY_RESPONSE = 0.24;
const ROUTE_SETTLE_MS = 260;
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

const worksThreeSlideTiming = {
  shaderMs: 1200,
  cardsMs: 760,
  completeMs: 1200
} as const;

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

function getCaptionFontSize(title: string) {
  const length = title.length;

  if (length > 18) return 64;
  if (length > 15) return 72;
  if (length > 12) return 86;
  return 108;
}

function getCaptionLetterSpacing(title: string) {
  const length = title.length;

  if (length > 18) return "0.06em";
  if (length > 15) return "0.1em";
  if (length > 12) return "0.16em";
  return "0.22em";
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
  sourceVideoRef: RefObject<HTMLVideoElement | null>;
  targetWorkIndex: number;
  worksLayerRef: RefObject<HTMLDivElement | null>;
  onComplete: () => void;
};

function WorksZoomTransition({
  active,
  direction,
  sourceImageSrc,
  sourceVideoRef,
  targetWorkIndex,
  worksLayerRef,
  onComplete
}: WorksZoomTransitionProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

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

    const canUseVideoTexture = (video: HTMLVideoElement | null) =>
      Boolean(
        direction === "open" &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      );

    void (async () => {
      try {
        const sourceVideo = sourceVideoRef.current;

        if (canUseVideoTexture(sourceVideo)) {
          texture = configureTexture(new THREE.VideoTexture(sourceVideo!));
          textureWidth = sourceVideo!.videoWidth || 1920;
          textureHeight = sourceVideo!.videoHeight || 1080;
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
  }, [active, direction, sourceImageSrc, sourceVideoRef, targetWorkIndex, worksLayerRef]);

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
};

export function HeroScrollVideoSection() {
  const captionFilterId = useId().replace(/:/g, "");
  const sectionRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<HTMLImageElement | null>(null);
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);
  const incomingVideoRef = useRef<HTMLVideoElement | null>(null);
  const posterOverlayRef = useRef<HTMLImageElement | null>(null);
  const transitionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentVideoSrcRef = useRef("");
  const activeSceneRef = useRef(0);
  const returnSceneRef = useRef(0);
  const worksLayerRef = useRef<HTMLDivElement | null>(null);
  const currentFrameIndexRef = useRef(1);
  const worksTimingTimersRef = useRef<number[]>([]);
  const transitionTweenRef = useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);
  const transitionRenderCleanupRef = useRef<(() => void) | null>(null);
  const transitionTokenRef = useRef(0);
  const slideShaderRef = useRef<SlideShaderRuntime | null>(null);
  const currentVideoTextureRef = useRef<{ src: string; texture: THREE.VideoTexture } | null>(null);
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

  const [activeScene, setActiveScene] = useState(0);
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
  const captionPalette = getCaptionPalette(currentScene);
  const captionFontSize = getCaptionFontSize(currentScene.heading);
  const captionLetterSpacing = getCaptionLetterSpacing(currentScene.heading);
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

  useEffect(() => routeManagerPlus.init(), []);

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

  type ShaderTextureSource = {
    texture: THREE.Texture;
    width: number;
    height: number;
    dispose: () => void;
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

  const createImageElementTexture = (image: HTMLImageElement): ShaderTextureSource => {
    const texture = configureShaderTexture(new THREE.Texture(image));
    return {
      texture,
      width: image.naturalWidth || image.width || 1920,
      height: image.naturalHeight || image.height || 1080,
      dispose: () => texture.dispose()
    };
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

  const loadImageTexture = async (src: string): Promise<ShaderTextureSource> => {
    const texture = configureShaderTexture(await new THREE.TextureLoader().loadAsync(src));
    const image = texture.image as HTMLImageElement | undefined;

    return {
      texture,
      width: image?.naturalWidth || image?.width || 1920,
      height: image?.naturalHeight || image?.height || 1080,
      dispose: () => texture.dispose()
    };
  };

  const createVideoTexture = (video: HTMLVideoElement): ShaderTextureSource => {
    const texture = configureShaderTexture(new THREE.VideoTexture(video), false);
    return {
      texture,
      width: video.videoWidth || 1920,
      height: video.videoHeight || 1080,
      dispose: () => texture.dispose()
    };
  };

  const waitForVideoFrame = (video: HTMLVideoElement) => {
    if (hasRenderableVideoFrame(video)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let resolved = false;
      let timeout = 0;

      let requestFrame = () => undefined;
      const done = (ready = false) => {
        if (resolved) return;

        resolved = true;
        window.clearTimeout(timeout);
        video.removeEventListener("loadedmetadata", requestFrame);
        video.removeEventListener("loadeddata", requestFrame);
        video.removeEventListener("canplay", requestFrame);
        if (ready && video.videoWidth > 0 && video.videoHeight > 0) {
          video.dataset.frameReady = "1";
        }
        resolve();
      };

      requestFrame = () => {
        if (video.videoWidth <= 0 || video.videoHeight <= 0 || video.readyState < 2) {
          return;
        }

        if (!requestVideoFrameOnce(video, () => done(true))) {
          done(true);
        }
      };

      timeout = window.setTimeout(() => done(false), 1200);
      video.addEventListener("loadedmetadata", requestFrame, { once: true });
      video.addEventListener("loadeddata", requestFrame, { once: true });
      video.addEventListener("canplay", requestFrame, { once: true });
      requestFrame();
    });
  };

  const setPosterOverlayVisible = (visible: boolean, src?: string) => {
    const poster = posterOverlayRef.current;
    if (!poster) return;

    if (src && poster.dataset.posterSrc !== src) {
      poster.dataset.posterSrc = src;
      poster.src = src;
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

  const revealCurrentVideo = () => {
    const currentVideo = currentVideoRef.current;
    if (!currentVideo) return;

    setPosterOverlayVisible(false);
    gsap.set(frameRef.current, { opacity: 0 });
    showHeroVideoLayer(currentVideo);
    gsap.set(currentVideo, {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      clipPath: "inset(0%)"
    });
    gsap.to(transitionCanvasRef.current, {
      opacity: 0,
      duration: 0.16,
      ease: "power1.out"
    });
  };

  const createCurrentShaderTexture = async (fromSlide: HomeSlide): Promise<ShaderTextureSource> => {
    const frame = frameRef.current;
    const currentVideo = currentVideoRef.current;

    if (
      fromSlide.kind === "work" &&
      fromSlide.src &&
      currentVideo &&
      currentVideoSrcRef.current === fromSlide.src &&
      hasRenderableVideoFrame(currentVideo)
    ) {
      return createVideoTexture(currentVideo);
    }

    if (fromSlide.kind === "work" && fromSlide.poster) {
      return loadImageTexture(fromSlide.poster);
    }

    if (frame?.complete && frame.naturalWidth > 0) {
      return createImageElementTexture(frame);
    }

    return loadImageTexture(heroFrameSrc(currentFrameIndexRef.current));
  };

  const createTargetShaderTexture = async (
    targetSlide: HomeSlide,
    token: number
  ): Promise<ShaderTextureSource> => {
    const incomingVideo = incomingVideoRef.current;

    if (targetSlide.kind === "work" && targetSlide.src && incomingVideo) {
      hideHeroVideoLayer(incomingVideo);
      incomingVideo.src = targetSlide.src;
      incomingVideo.dataset.src = targetSlide.src;
      incomingVideo.dataset.frameReady = "0";
      incomingVideo.poster = targetSlide.poster;
      incomingVideo.currentTime = 0;
      incomingVideo.load();
      incomingVideo.play().catch(() => undefined);
      await waitForVideoFrame(incomingVideo);

      if (token !== transitionTokenRef.current) {
        throw new Error("transition-cancelled");
      }

      if (hasRenderableVideoFrame(incomingVideo)) {
        return createVideoTexture(incomingVideo);
      }
    }

    return loadImageTexture(targetSlide.poster || heroFrameSrc(currentFrameIndexRef.current));
  };

  const finishDomToSlide = (targetSlide: HomeSlide) => {
    const frame = frameRef.current;
    const currentVideo = currentVideoRef.current;
    const incomingVideo = incomingVideoRef.current;
    const nextSrc = sourceForSlide(targetSlide);

    if (targetSlide.kind === "opening") {
      currentVideoSrcRef.current = "";
      currentVideoTextureRef.current?.texture.dispose();
      currentVideoTextureRef.current = null;
      currentVideo?.pause();
      incomingVideo?.pause();
      if (currentVideo) currentVideo.dataset.frameReady = "0";
      if (incomingVideo) incomingVideo.dataset.frameReady = "0";
      hideHeroVideoLayer(currentVideo);
      hideHeroVideoLayer(incomingVideo);
      setPosterOverlayVisible(false);
      if (frame) {
        gsap.set(frame, {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          clipPath: "inset(0%)"
        });
      }
      return;
    }

    if (!currentVideo || !incomingVideo) return;

    if (nextSrc) {
      const nextTime = Number.isFinite(incomingVideo.currentTime) ? incomingVideo.currentTime : 0;

      currentVideoTextureRef.current?.texture.dispose();
      currentVideoTextureRef.current = null;
      currentVideo.src = nextSrc;
      currentVideo.dataset.src = nextSrc;
      currentVideo.dataset.frameReady = "0";
      currentVideo.poster = targetSlide.poster;
      currentVideo.load();
      try {
        currentVideo.currentTime = nextTime;
      } catch {
        // Some browsers reject seeking before metadata is ready; playback still starts at the first frame.
      }
      currentVideo.play().catch(() => undefined);
      scheduleRenderableVideoFrame(currentVideo, nextSrc);
      currentVideoSrcRef.current = nextSrc;
      gsap.set(frame, { opacity: 0 });
      setPosterOverlayVisible(false);
      showHeroVideoLayer(currentVideo);
      gsap.set(currentVideo, { opacity: 1, scale: 1, filter: "blur(0px)", clipPath: "inset(0%)" });
      hideHeroVideoLayer(incomingVideo);
      gsap.set(incomingVideo, { scale: 1, filter: "blur(0px)", clipPath: "inset(0%)" });
      incomingVideo.pause();
      incomingVideo.dataset.frameReady = "0";
      incomingVideo.removeAttribute("src");
      incomingVideo.load();
      return;
    }

    currentVideoSrcRef.current = "";
    currentVideoTextureRef.current?.texture.dispose();
    currentVideoTextureRef.current = null;
    currentVideo.pause();
    currentVideo.dataset.frameReady = "0";
    currentVideo.removeAttribute("src");
    currentVideo.load();
    incomingVideo.pause();
    incomingVideo.dataset.frameReady = "0";
    incomingVideo.removeAttribute("src");
    incomingVideo.load();
    gsap.set(frame, { opacity: 0 });
    hideHeroVideoLayer(currentVideo);
    hideHeroVideoLayer(incomingVideo);
  };

  const runVideoTransition = (targetScene: number, skipAnimation = false, fromScene = activeSceneRef.current) => {
    const targetSlide = homeSlides[targetScene] ?? openingSlide;
    const fromSlide = homeSlides[fromScene] ?? openingSlide;
    const canvas = transitionCanvasRef.current;

    transitionTweenRef.current?.kill();
    transitionRenderCleanupRef.current?.();
    transitionRenderCleanupRef.current = null;
    const token = ++transitionTokenRef.current;

    if (targetSlide.kind === "opening" || skipAnimation || fromScene === targetScene || !canvas) {
      finishDomToSlide(targetSlide);
      return;
    }

    const nextSrc = sourceForSlide(targetSlide);
    if (nextSrc && currentVideoSrcRef.current === nextSrc) {
      currentVideoRef.current?.play().catch(() => undefined);
      return;
    }

    void (async () => {
      let sourceTexture: ShaderTextureSource | null = null;
      let targetTexture: ShaderTextureSource | null = null;

      try {
        sourceTexture = await createCurrentShaderTexture(fromSlide);
        targetTexture = await createTargetShaderTexture(targetSlide, token);
      } catch {
        sourceTexture?.dispose();
        targetTexture?.dispose();
        if (token === transitionTokenRef.current) finishDomToSlide(targetSlide);
        return;
      }

      if (token !== transitionTokenRef.current) {
        sourceTexture.dispose();
        targetTexture.dispose();
        return;
      }

      const pixelRatio = getShaderPixelRatio();
      const width = Math.max(1, window.innerWidth || canvas.clientWidth);
      const height = Math.max(1, window.innerHeight || canvas.clientHeight);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        premultipliedAlpha: false
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2,
        -1000,
        1000
      );
      camera.position.z = 1;

      const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
      const uniforms = {
        texture1: { value: sourceTexture.texture },
        texture2: { value: targetTexture.texture },
        uvRate1: {
          value: coverUvRate(sourceTexture.width, sourceTexture.height, width, height)
        },
        uvRate2: {
          value: coverUvRate(targetTexture.width, targetTexture.height, width, height)
        },
        progress: { value: 0 },
        mask: { value: new THREE.Vector3(1, 1, 0) },
        translateDelay: { value: new THREE.Vector4(-0.5, 1, 1, 2) },
        accel: { value: new THREE.Vector2(0.5, 2) },
        waveAmpFreq: { value: new THREE.Vector4(0, 0.5, 0, 4) },
        waveSpeedBlend: { value: new THREE.Vector4(0, 0.3, 0.5, 0.5) },
        pixels: { value: new THREE.Vector4(width * pixelRatio, height * pixelRatio, 1, 1) },
        velocity: { value: 0 },
        direction: { value: 1 },
        time: { value: new THREE.Vector4(0, 0, 0, 0) }
      };
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

      let raf = 0;
      const startedAt = performance.now();
      const render = () => {
        uniforms.time.value.y = (performance.now() - startedAt) / 1000;
        renderer.render(scene, camera);
        raf = window.requestAnimationFrame(render);
      };

      transitionRenderCleanupRef.current = () => {
        window.cancelAnimationFrame(raf);
        transitionTweenRef.current?.kill();
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        sourceTexture?.dispose();
        targetTexture?.dispose();
        gsap.set(canvas, { opacity: 0 });
      };

      gsap.set(canvas, { opacity: 1 });
      gsap.set(frameRef.current, { opacity: 0 });
      render();

      transitionTweenRef.current = gsap.to(uniforms.progress, {
        value: 1,
        duration: worksThreeSlideTiming.shaderMs / 1000,
        ease: "power3.inOut",
        onComplete: () => {
          if (token !== transitionTokenRef.current) return;

          finishDomToSlide(targetSlide);
          gsap.to(canvas, {
            opacity: 0,
            duration: 0.12,
            ease: "power1.out",
            onComplete: () => {
              if (token !== transitionTokenRef.current) return;

              transitionRenderCleanupRef.current?.();
              transitionRenderCleanupRef.current = null;
            }
          });
        }
      });
    })();
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
    slidePreviewEntriesRef.current.forEach((entry, index) => {
      if (!slidePreviewDesiredRef.current.has(index) && !entry.video.paused) {
        entry.video.pause();
      }
    });
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
      lastTexture2Version: -1
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
    const texture2 = createSlotFromSlide(nextSlide, nextWorkIndex);

    if (!texture1 || !texture2) {
      return false;
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

    if (!shaderStateChanged && !videoFrameChanged && !transitionIsAlive) {
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
  };

  const hasRenderableSlideShaderPair = () => {
    const runtime = slideShaderRef.current;
    return Boolean(runtime?.pairKey);
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
    }, worksThreeSlideTiming.cardsMs);
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
    }
  };

  const warmCurrentWorkVideo = async (workIndex: number, reveal: boolean) => {
    const targetWorkIndex = clamp(workIndex, 0, WORKS.length - 1);
    const targetScene = targetWorkIndex + 1;
    const targetSlide = homeSlides[targetScene] ?? homeSlides[1] ?? openingSlide;
    const currentVideo = currentVideoRef.current;
    const nextSrc = sourceForSlide(targetSlide);

    if (!currentVideo || !nextSrc) {
      return false;
    }

    setVideoElementSource(currentVideo, targetSlide, "current");
    currentVideoSrcRef.current = nextSrc;
    await waitForVideoFrame(currentVideo);

    const ready =
      currentVideo.dataset.src === nextSrc &&
      hasRenderableVideoFrame(currentVideo);

    if (ready && reveal) {
      revealCurrentVideo();
    }

    return ready;
  };

  const selectWorkFromWorks = (workIndex: number) => {
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

    const videoReadyPromise = warmCurrentWorkVideo(targetWorkIndex, false);

    const pairReady = setSlideShaderPair(targetWorkIndex, modulo(targetWorkIndex + 1, WORKS.length));
    if (pairReady) {
      renderSlideShader(0, performance.now() / 1000);
      gsap.set(transitionCanvasRef.current, { opacity: 1 });
      setPosterOverlayVisible(false);
    } else {
      gsap.set(transitionCanvasRef.current, { opacity: 0 });
      setPosterOverlayVisible(true);
    }

    hideHeroVideoLayer(currentVideoRef.current);

    commitActiveScene(targetScene, true);
    setIsListView(false);
    setIsZoomingWorks(false);
    setIsWorksView(false);
    gsap.set(worksLayerRef.current, { autoAlpha: 0, pointerEvents: "none" });
    worksLayerRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });

    window.setTimeout(() => {
      dissolveCard(360);
    }, 80);

    videoReadyPromise.then((videoReady) => {
      if (!videoReady || activeSceneRef.current !== targetScene) {
        return;
      }

      revealCurrentVideo();
    });
  };

  const completeWorksZoom = () => {
    clearWorksTimingTimers();
    setIsZoomingWorks(false);

    if (zoomDirection === "close") {
      setIsWorksView(false);
      setRouteForScene(returnSceneRef.current);
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
      setLoopOpacity(frame, 0);
      setLoopOpacity(canvas, canHoldPreviousPair ? 1 : 0);
      if (canHoldPreviousPair) {
        const currentVideo = currentVideoRef.current;
        const settledOnWork =
          !transitionIsMoving &&
          rawTransition < TAO_SETTLE_EPSILON &&
          activeSlide.kind === "work" &&
          Boolean(currentVideo);
        let isShowingSettledVideo = false;

        if (settledOnWork && currentVideo) {
          setVideoElementSource(currentVideo, activeSlide, "current");
          currentVideoSrcRef.current = activeSlide.src;
          isShowingSettledVideo = hasRenderableVideoFrame(currentVideo);

          if (isShowingSettledVideo) {
            showHeroVideoLayer(currentVideo);
            setLoopOpacity(currentVideo, 1);
            pauseSlidePreviewPlayback();
            setLoopOpacity(canvas, 0);
            const runtime = slideShaderRef.current;
            if (
              runtime &&
              runtime.texture1.image !== currentVideo &&
              runtime.texture2.image !== currentVideo
            ) {
              runtime.pairKey = "";
            }
          }
        }

        if (!isShowingSettledVideo) {
          hideHeroVideoLayer(currentVideo);
          if (!settledOnWork) {
            currentVideo?.pause();
          }
        }
      }
      setPosterOverlayVisible(
        activeSlide.kind === "work" && !canHoldPreviousPair,
        activeSlide.poster
      );

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
      } else {
        gsap.set(canvas, { opacity: 0 });
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
      transitionTweenRef.current?.kill();
      transitionRenderCleanupRef.current?.();
      if (routeCommitTimerRef.current !== null) {
        window.clearTimeout(routeCommitTimerRef.current);
      }
      if (slidePreviewFlushTimerRef.current !== null) {
        window.clearTimeout(slidePreviewFlushTimerRef.current);
        slidePreviewFlushTimerRef.current = null;
      }
      currentVideoRef.current?.pause();
      incomingVideoRef.current?.pause();
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
            "fixed left-0 top-0 z-40 h-[100dvh] w-screen overflow-y-auto bg-white opacity-0",
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
            "absolute inset-0 z-0 block h-full w-full appearance-none border-0 bg-transparent p-0",
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
          <video
            ref={incomingVideoRef}
            data-hero-video="incoming"
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

        {currentScene.kind === "work" && (
          <img
            ref={posterOverlayRef}
            src={currentScene.poster}
            alt=""
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover opacity-0 transition-opacity duration-200"
          />
        )}

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
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="transition-opacity duration-300 hover:opacity-100"
              >
                Facebook
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
                key={currentScene.id}
                className={clsx(
                  "w-[min(92vw,1120px)] max-w-none text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  !isListView && !isWorksActive && "tao-slide-text",
                  isListView || isWorksActive
                    ? "translate-y-8 scale-[0.98] opacity-0"
                    : "translate-y-0 opacity-100",
                  isListView || isWorksActive ? "text-[#171411]" : "text-white"
                )}
              >
                <p
                  className={clsx(
                    "font-mono text-[11px] uppercase tracking-[0.48em] md:text-xs",
                    isListView || isWorksActive ? "text-[#171411]/62" : "text-white/70"
                  )}
                >
                  {currentScene.kicker}
                </p>
                <h1 className="flor-video-caption-heading mt-5" aria-label={currentScene.heading}>
                  <span className="sr-only">{currentScene.heading}</span>
                  <svg
                    aria-hidden="true"
                    className="flor-video-caption-svg"
                    viewBox="-220 0 1640 160"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <filter
                        id={`${captionFilterId}-caption-outline`}
                        x="-25%"
                        y="-35%"
                        width="150%"
                        height="170%"
                        colorInterpolationFilters="sRGB"
                      >
                        <feMorphology
                          in="SourceAlpha"
                          operator="dilate"
                          radius="2.65"
                          result="expanded"
                        />
                        <feMorphology
                          in="SourceAlpha"
                          operator="erode"
                          radius="0"
                          result="contracted"
                        />
                        <feComposite
                          in="expanded"
                          in2="contracted"
                          operator="out"
                          result="outline"
                        />
                        <feFlood
                          floodColor="rgba(255,255,255,0.74)"
                          result="outlineColor"
                        />
                        <feComposite in="outlineColor" in2="outline" operator="in" />
                      </filter>
                      <mask
                        id={`${captionFilterId}-caption-mask`}
                        maskUnits="userSpaceOnUse"
                        x="-220"
                        y="0"
                        width="1640"
                        height="160"
                      >
                        <rect x="-220" y="0" width="1640" height="160" fill="black" />
                        <text
                          filter={`url(#${captionFilterId}-caption-outline)`}
                          x="600"
                          y="96"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize={captionFontSize}
                          letterSpacing={captionLetterSpacing}
                        >
                          {currentScene.heading}
                        </text>
                      </mask>
                      <linearGradient
                        id={`${captionFilterId}-caption-gradient`}
                        gradientUnits="userSpaceOnUse"
                        x1="-220"
                        y1="0"
                        x2="1420"
                        y2="0"
                      >
                        <stop offset="0%" stopColor={captionPalette[0]} stopOpacity="0.22" />
                        <stop offset="18%" stopColor={captionPalette[1]} stopOpacity="0.95" />
                        <stop offset="38%" stopColor={captionPalette[2]} stopOpacity="1" />
                        <stop offset="58%" stopColor={captionPalette[3]} stopOpacity="0.96" />
                        <stop offset="78%" stopColor={captionPalette[0]} stopOpacity="0.92" />
                        <stop offset="100%" stopColor={captionPalette[1]} stopOpacity="0.34" />
                      </linearGradient>
                    </defs>
                    <rect
                      className="flor-video-caption-gradient"
                      x="-220"
                      y="0"
                      width="1640"
                      height="160"
                      fill={`url(#${captionFilterId}-caption-gradient)`}
                      mask={`url(#${captionFilterId}-caption-mask)`}
                    />
                  </svg>
                </h1>
                <p
                  className={clsx(
                    "mt-4 text-sm uppercase tracking-[0.4em] md:text-[13px]",
                    isListView || isWorksActive ? "text-[#171411]/58" : "text-white/70"
                  )}
                >
                  {currentScene.title}
                </p>
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
              <div className="absolute left-0 right-0 top-[2.7rem] h-px bg-white/72 md:top-[3rem]" />
              <span className="absolute left-0 top-[2.7rem] h-0 w-0 -translate-y-1/2 border-b-[5px] border-r-[18px] border-t-[5px] border-b-transparent border-r-white/78 border-t-transparent md:top-[3rem]" />
              <span className="absolute right-0 top-[2.7rem] h-0 w-0 -translate-y-1/2 border-b-[5px] border-l-[18px] border-t-[5px] border-b-transparent border-l-white/78 border-t-transparent md:top-[3rem]" />

              <div className="grid grid-cols-[1fr,auto,1fr] items-start gap-4 md:gap-8">
                <button
                  type="button"
                  onClick={() => scrollToScene(previousSceneIndex)}
                  className="pointer-events-auto justify-self-start text-left"
                >
                  <p className="font-mono text-[13px] tracking-[0.16em] text-white/52 md:text-[14px]">
                    #{previousScene.id}
                  </p>
                  <p className="mt-1 text-[0.95rem] font-semibold italic tracking-[0.05em] text-white/95 md:text-[1.6rem]">
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
                  className="pointer-events-auto justify-self-end text-right"
                >
                  <p className="font-mono text-[13px] tracking-[0.16em] text-white/92 md:text-[14px]">
                    #{nextScene.id}
                  </p>
                  <p className="mt-1 text-[0.95rem] font-semibold italic tracking-[0.05em] text-white md:text-[1.6rem]">
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
