"use client";

import {
  forwardRef,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { WORKS, type WorkItem, worksPath } from "@/data/works";
import { routeManagerPlus } from "@/components/site/route-manager-plus";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randRange(min: number, max: number, step: number): number {
  const n = Math.round((max - min) / step);
  return min + Math.round(Math.random() * n) * step;
}

// TAO smoothStep for card-click zoom (corners + sway)
function smoothStepZoom(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(edge1 - edge0, 0.0001)));
  return t * t * (3 - 2 * t);
}

// TAO createRandomArray(4) — shuffled corner delay indices
function shuffled4(): number[] {
  const a = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCanvasPixelRatio() {
  const pixelArea = window.innerWidth * window.innerHeight * Math.max(1, window.devicePixelRatio || 1);
  const maxRatio = pixelArea > 2_800_000 ? 1.25 : 1.5;
  return Math.min(window.devicePixelRatio || 1, maxRatio);
}

// SSR-safe layout effect
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const tajimaSerifStyle = {
  fontFamily: "Georgia, 'Times New Roman', serif"
};

// ─── Data ────────────────────────────────────────────────────────────────────

// ─── Card-click zoom shaders (TAO ControllerThreeListItemZoom) ──────────────
const cardZoomVertexShader = `
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
    vDark = mix(1.0, 0.7, corner);
    gl_Position = projectionMatrix * viewMatrix * mix(listPosition, slidePosition, corner);
  }
`;

const cardZoomFragmentShader = `
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

  float tri(float v) { return mix(v, 1.0 - v, step(0.5, v)) * 2.0; }

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

const tajimaHoverVertexShader = `
  uniform vec3 uHover;
  uniform vec3 uTextureSize;
  uniform vec4 uTime;

  varying vec2 vUv;
  varying float vDark;

  const float AREA1 = 300.0;
  const float AREA2 = 700.0;

  void main() {
    vec3 pos = position;
    vec4 listPosition = modelMatrix * vec4(position, 1.0);
    float len1 = length((uv - uHover.xy) * uTextureSize.xy);
    float str1 = max(0.0, 1.0 - len1 / AREA1);
    float len2 = length(listPosition.xy);
    float str2 = clamp(1.0 - len2 / AREA2, 0.25, 1.0);

    pos.z += sin(uTime.y + len1 / 32.0) * 24.0 * str1 * str2 * uHover.z;
    vUv = uv;
    vDark = 1.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const tajimaHoverFragmentShader = `
  precision highp float;

  varying vec2 vUv;
  varying float vDark;

  uniform vec4 uTime;
  uniform float uProgress;
  uniform vec2 uTranslate;
  uniform vec2 uDelay;
  uniform vec2 uAccel;
  uniform float uEdge;
  uniform vec4 uWaveAmpFreq;
  uniform vec4 uWaveSpeedPhase;
  uniform vec2 uWaveBlend;
  uniform float uOpacity;
  uniform sampler2D uTexture1;
  uniform sampler2D uTexture2;

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
    vec2 uv = vUv;
    float delayValue = uProgress * (1.0 + uDelay.x + uDelay.y) - uv.y * uDelay.y - (1.0 - uv.x) * uDelay.x;
    delayValue = clamp(delayValue, 0.0, 1.0);

    vec2 translateValue = uProgress + delayValue * uAccel.xy;
    vec2 translateValue1 = uTranslate * translateValue;
    vec2 translateValue2 = uTranslate * (translateValue - 1.0 - uAccel.xy);
    vec2 wave = sin(uTime.y * uWaveSpeedPhase.xy + uv.yx * uWaveAmpFreq.zw + uWaveSpeedPhase.zw) * uWaveAmpFreq.xy;
    vec2 uvWave = (tri(uProgress) * uWaveBlend.x + tri(delayValue) * uWaveBlend.y) * wave;

    vec4 color1 = texture2D(uTexture1, mirrored(vUv + translateValue1 + uvWave));
    vec4 color2 = texture2D(uTexture2, mirrored(vUv + translateValue2 + uvWave));
    float threshold = step(1.0 - uv.x, delayValue);
    vec4 color = mix(color1, color2, mix(delayValue, threshold, uEdge));

    color *= vec4(vec3(vDark), uOpacity);
    gl_FragColor = color;
  }
`;

type WorksMediaRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type WorksHoverPointerResult = {
  hit: boolean;
  x: number;
  y: number;
};

interface WorksHoverCanvasHandle {
  register: (
    index: number,
    src: string,
    poster: string,
    getRect: () => WorksMediaRect | null,
    getImage: () => HTMLImageElement | null
  ) => void;
  unregister: (index: number) => void;
  observeCard: (index: number, el: HTMLElement) => void;
  enter: (index: number) => void;
  leave: (index: number) => void;
  move: (
    index: number,
    clientX: number,
    clientY: number
  ) => WorksHoverPointerResult;
  zoomIn: (index: number, onComplete: () => void) => boolean;
}

type WorksHoverUniforms = {
  uTexture1: { value: THREE.Texture };
  uTexture2: { value: THREE.Texture };
  uProgress: { value: number };
  uTime: { value: THREE.Vector4 };
  uHover: { value: THREE.Vector3 };
  uTextureSize: { value: THREE.Vector3 };
  uTranslate: { value: THREE.Vector2 };
  uDelay: { value: THREE.Vector2 };
  uAccel: { value: THREE.Vector2 };
  uEdge: { value: number };
  uWaveAmpFreq: { value: THREE.Vector4 };
  uWaveSpeedPhase: { value: THREE.Vector4 };
  uWaveBlend: { value: THREE.Vector2 };
  uOpacity: { value: number };
};

type WorksZoomUniforms = {
  uTexture:  { value: THREE.Texture };
  uListPosition: { value: THREE.Vector2 };
  uListSize: { value: THREE.Vector2 };
  uSlideSize: { value: THREE.Vector2 };
  uTextureAspect: { value: number };
  uListAspect: { value: number };
  uSlideAspect: { value: number };
  uZoomScale: { value: number };
  uSway:     { value: number };
  uCorners:  { value: THREE.Vector4 };
  uProgress: { value: number };
  uTime:     { value: number };
};

type WorksHoverItem = {
  index: number;
  src: string;
  poster: string;
  getRect: () => WorksMediaRect | null;
  getImage: () => HTMLImageElement | null;
  video: HTMLVideoElement;
  videoLoaded: boolean;
  stillImage: HTMLImageElement | null;
  stillTextureReady: boolean;
  stillTexture: THREE.Texture;
  texture: THREE.VideoTexture | null;
  geometry: THREE.PlaneGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  uniforms: WorksHoverUniforms;
  progressTween: gsap.core.Tween | null;
  scaleTween: gsap.core.Tween | null;
  hoverStrengthTween: gsap.core.Tween | null;
  scale: { value: number };
  hoverTarget: { x: number; y: number };
  hoverCurrent: { x: number; y: number };
  hoverStrength: { value: number };
  speed: { value: number };
  isHoverActive: boolean;
  // Card-click zoom (TAO ControllerThreeListItemZoom)
  zoomMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  zoomUniforms: WorksZoomUniforms | null;
  zoomTween: gsap.core.Timeline | null;
  zoomProgress1: { value: number };
  zoomProgress2: { value: number };
  zoomRandom: number[];
  zoomFadeTargets: HTMLElement[];
  isZooming: boolean;
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

const GlobalWorksHoverCanvas = forwardRef<WorksHoverCanvasHandle>(
  function GlobalWorksHoverCanvas(_, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frameIdRef = useRef<number | null>(null);
    const renderLoopRef = useRef<(() => void) | null>(null);
    const apiRef = useRef<{
      renderer: THREE.WebGLRenderer | null;
      scene: THREE.Scene | null;
      camera: THREE.PerspectiveCamera | null;
      raycaster: THREE.Raycaster;
      pointer: THREE.Vector2;
      items: Map<number, WorksHoverItem>;
      viewport: { width: number; height: number };
      startedAt: number;
      videoObserver: IntersectionObserver | null;
    }>({
      renderer: null,
      scene: null,
      camera: null,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      items: new Map(),
      viewport: { width: 1, height: 1 },
      startedAt: 0,
      videoObserver: null
    });

    const wakeRenderLoop = () => {
      renderLoopRef.current?.();
    };

    // Shared IntersectionObserver — loads video.src only when card enters viewport
    const getVideoObserver = () => {
      if (apiRef.current.videoObserver) return apiRef.current.videoObserver;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const idx = Number((entry.target as HTMLElement).dataset.videoIndex);
            const item = apiRef.current.items.get(idx);
            if (!item) {
              return;
            }

            warmStillTexture(item);
            obs.unobserve(entry.target);
          });
        },
        { rootMargin: "200px" }
      );
      apiRef.current.videoObserver = obs;
      return obs;
    };

    const createHoverVideoTexture = (video: HTMLVideoElement) => {
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      return texture;
    };

    const ensureVideoTexture = (item: WorksHoverItem) => {
      if (
        !item.src ||
        item.video.readyState < 2 ||
        item.video.videoWidth <= 0 ||
        item.video.videoHeight <= 0
      ) {
        return null;
      }

      if (!item.texture) {
        item.texture = createHoverVideoTexture(item.video);
      }

      return item.texture;
    };

    const syncVideoTexture = (item: WorksHoverItem) => {
      const videoTexture = ensureVideoTexture(item);

      if (!videoTexture) {
        return false;
      }

      item.uniforms.uTexture2.value = videoTexture;
      wakeRenderLoop();
      return true;
    };

    const warmStillTexture = (item: WorksHoverItem) => {
      const image = item.getImage();

      if (!image) {
        return false;
      }

      if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        if (item.stillImage !== image) {
          item.stillImage = image;
          image.addEventListener(
            "load",
            () => {
              if (apiRef.current.items.get(item.index) === item) {
                warmStillTexture(item);
              }
            },
            { once: true }
          );
        }

        return false;
      }

      if (item.stillTextureReady && item.stillImage === image) {
        return true;
      }

      item.stillImage = image;
      item.stillTexture.image = image;
      item.stillTexture.needsUpdate = true;
      item.stillTextureReady = true;
      item.uniforms.uTexture1.value = item.stillTexture;

      if (!item.texture) {
        item.uniforms.uTexture2.value = item.stillTexture;
      }

      wakeRenderLoop();
      return true;
    };

    const warmItemVideo = (item: WorksHoverItem, keepPlaying = false) => {
      if (!item.src) {
        return;
      }

      item.video.preload = "auto";

      if (!item.videoLoaded) {
        item.videoLoaded = true;
        item.video.src = item.src;
        item.video.load();
      }

      const settle = () => {
        if (!syncVideoTexture(item)) {
          return;
        }

        if (!keepPlaying && !item.isHoverActive && !item.isZooming) {
          item.video.pause();
        }
      };

      const requestFrame = () => {
        if (item.video.readyState < 2 || item.video.videoWidth <= 0 || item.video.videoHeight <= 0) {
          return;
        }

        if (!requestVideoFrameOnce(item.video, settle)) {
          settle();
        }
      };

      item.video.addEventListener("loadeddata", requestFrame, { once: true });
      item.video.addEventListener("canplay", requestFrame, { once: true });
      item.video.play().catch(() => undefined);
      requestFrame();
    };

    const createItem = (
      index: number,
      src: string,
      poster: string,
      getRect: () => WorksMediaRect | null,
      getImage: () => HTMLImageElement | null
    ) => {
      const hasVideo = Boolean(src);
      const video = document.createElement("video");
      // src is deferred — set by IntersectionObserver when card enters viewport
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";

      const stillTexture = new THREE.Texture();
      stillTexture.colorSpace = THREE.SRGBColorSpace;
      stillTexture.minFilter = THREE.LinearFilter;
      stillTexture.magFilter = THREE.LinearFilter;
      stillTexture.wrapS = THREE.ClampToEdgeWrapping;
      stillTexture.wrapT = THREE.ClampToEdgeWrapping;
      stillTexture.generateMipmaps = false;

      const uniforms: WorksHoverUniforms = {
        uTexture1: { value: stillTexture },
        uTexture2: { value: stillTexture },
        uProgress: { value: 0 },
        uTime: { value: new THREE.Vector4(0, 0, 0, 1) },
        uHover: { value: new THREE.Vector3(0.5, 0.5, 0) },
        uTextureSize: { value: new THREE.Vector3(960, 540, 960 / 540) },
        uTranslate: { value: new THREE.Vector2(-0.2, 0.4) },
        uDelay: { value: new THREE.Vector2(1, 1) },
        uAccel: { value: new THREE.Vector2(2, 2) },
        uEdge: { value: 0 },
        uWaveAmpFreq: { value: new THREE.Vector4(0, 0.5, 0, 4) },
        uWaveSpeedPhase: { value: new THREE.Vector4(0, 0.3, 0, 0) },
        uWaveBlend: { value: new THREE.Vector2(0.2, 0.8) },
        uOpacity: { value: 1 }
      };

      const geometry = new THREE.PlaneGeometry(1, 1, 96, 54);
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: tajimaHoverVertexShader,
        fragmentShader: tajimaHoverFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      apiRef.current.scene?.add(mesh);

      const item: WorksHoverItem = {
        index,
        src,
        poster,
        getRect,
        getImage,
        video,
        videoLoaded: !hasVideo,
        stillImage: null,
        stillTextureReady: false,
        stillTexture,
        texture: null,
        geometry,
        material,
        mesh,
        uniforms,
        progressTween: null,
        scaleTween: null,
        hoverStrengthTween: null,
        scale: { value: 1 },
        hoverTarget: { x: 0, y: 0 },
        hoverCurrent: { x: 0, y: 0 },
        hoverStrength: { value: 0 },
        speed: { value: 0 },
        isHoverActive: false,
        zoomMesh: null,
        zoomUniforms: null,
        zoomTween: null,
        zoomProgress1: { value: 0 },
        zoomProgress2: { value: 0 },
        zoomRandom: [0, 1, 2, 3],
        zoomFadeTargets: [],
        isZooming: false
      };

      if (hasVideo) {
        const handleVideoReady = () => {
          syncVideoTexture(item);
        };
        video.addEventListener("loadeddata", handleVideoReady);
        video.addEventListener("canplay", handleVideoReady);
      }

      apiRef.current.items.set(index, item);
      return item;
    };

    const destroyItem = (item: WorksHoverItem) => {
      item.progressTween?.kill();
      item.scaleTween?.kill();
      item.hoverStrengthTween?.kill();
      item.zoomTween?.kill();
      item.zoomFadeTargets.forEach((target) => {
        target.style.opacity = "";
        target.style.pointerEvents = "";
        target.style.willChange = "";
      });
      item.zoomFadeTargets = [];
      if (item.zoomMesh) {
        apiRef.current.scene?.remove(item.zoomMesh);
        item.zoomMesh.geometry.dispose();
        item.zoomMesh.material.dispose();
        item.zoomMesh = null;
      }
      apiRef.current.scene?.remove(item.mesh);
      item.video.pause();
      item.video.src = "";
      item.stillTexture.dispose();
      item.texture?.dispose();
      item.geometry.dispose();
      item.material.dispose();
    };

    const restoreZoomFadeTargets = (item: WorksHoverItem) => {
      item.zoomFadeTargets.forEach((target) => {
        target.style.opacity = "";
        target.style.pointerEvents = "";
        target.style.willChange = "";
      });
      item.zoomFadeTargets = [];
    };

    const syncItemMesh = (item: WorksHoverItem) => {
      const rect = item.getRect();
      if (!rect) {
        return null;
      }

      const api = apiRef.current;
      const hoverScale = Math.max(item.scale.value, 0.001);
      const overflowX = Math.max(0, (rect.width * hoverScale - rect.width) / 2);
      const overflowY = Math.max(0, (rect.height * hoverScale - rect.height) / 2);
      const baseX = rect.left + rect.width / 2 - api.viewport.width / 2 - item.hoverCurrent.x * overflowX;
      const baseY = api.viewport.height / 2 - (rect.top + rect.height / 2) + item.hoverCurrent.y * overflowY;
      const cameraZ = api.camera?.position.z ?? 0;
      item.mesh.position.set(
        baseX / hoverScale,
        baseY / hoverScale,
        cameraZ - cameraZ / hoverScale
      );
      item.mesh.scale.set(rect.width, rect.height, 1);
      item.mesh.updateMatrixWorld(true);

      return rect;
    };

    const moveItemByRaycast = (
      item: WorksHoverItem,
      clientX: number,
      clientY: number
    ): WorksHoverPointerResult => {
      const api = apiRef.current;
      if (!api.camera || !syncItemMesh(item)) {
        return { hit: false, x: item.hoverTarget.x, y: item.hoverTarget.y };
      }

      api.pointer.set(
        (clientX / Math.max(api.viewport.width, 1)) * 2 - 1,
        -(clientY / Math.max(api.viewport.height, 1)) * 2 + 1
      );
      api.raycaster.setFromCamera(api.pointer, api.camera);

      const hit = api.raycaster.intersectObject(item.mesh, false)[0];
      if (!hit?.uv) {
        return { hit: false, x: item.hoverTarget.x, y: item.hoverTarget.y };
      }

      const x = hit.uv.x * 2 - 1;
      const y = (1 - hit.uv.y) * 2 - 1;
      item.hoverTarget.x = x;
      item.hoverTarget.y = y;

      return { hit: true, x, y };
    };

    useImperativeHandle(ref, () => ({
      register: (index, src, poster, getRect, getImage) => {
        const existing = apiRef.current.items.get(index);
        if (existing) {
          existing.getRect = getRect;
          existing.getImage = getImage;
          if (existing.poster !== poster) {
            existing.poster = poster;
            existing.stillImage = null;
            existing.stillTextureReady = false;
            existing.stillTexture.image = null;
            existing.stillTexture.needsUpdate = true;
            if (!existing.src) {
              existing.uniforms.uTexture2.value = existing.stillTexture;
            }
          }
          if (existing.src !== src) {
            existing.src = src;
            existing.videoLoaded = !src;
            existing.video.removeAttribute("src");
            existing.video.load();
            existing.texture?.dispose();
            existing.texture = null;
            existing.uniforms.uTexture2.value = existing.stillTexture;
          }
          warmStillTexture(existing);
          return;
        }

        createItem(index, src, poster, getRect, getImage);
      },
      observeCard: (index, el) => {
        const item = apiRef.current.items.get(index);
        if (!item) {
          return;
        }
        el.dataset.videoIndex = String(index);
        getVideoObserver().observe(el);
      },
      unregister: (index) => {
        const item = apiRef.current.items.get(index);
        if (!item) {
          return;
        }

        destroyItem(item);
        apiRef.current.items.delete(index);
      },
      enter: (index) => {
        const item = apiRef.current.items.get(index);
        if (!item) {
          return;
        }

        warmStillTexture(item);
        item.mesh.visible = true;
        item.isHoverActive = true;
        syncItemMesh(item);
        warmItemVideo(item, true);
        wakeRenderLoop();
        item.progressTween?.kill();
        item.scaleTween?.kill();
        item.hoverStrengthTween?.kill();

        item.hoverStrengthTween = gsap.to(item.hoverStrength, {
          value: 1,
          duration: 0.6,
          ease: "power3.out",
          overwrite: "auto"
        });

        item.progressTween = gsap.to(item.uniforms.uProgress, {
          value: 1,
          duration: 1,
          ease: "power3.out",
          overwrite: "auto"
        });

        item.scaleTween = gsap.to(item.scale, {
          value: 1.25,
          duration: 0.6,
          ease: "back.out(1.7)",
          overwrite: "auto"
        });
      },
      leave: (index) => {
        const item = apiRef.current.items.get(index);
        if (!item) {
          return;
        }

        item.hoverTarget.x = 0;
        item.hoverTarget.y = 0;
        wakeRenderLoop();
        item.progressTween?.kill();
        item.scaleTween?.kill();
        item.hoverStrengthTween?.kill();
        item.hoverStrengthTween = gsap.to(item.hoverStrength, {
          value: 0,
          duration: 0.7,
          ease: "power3.out",
          overwrite: "auto"
        });

        item.progressTween = gsap.to(item.uniforms.uProgress, {
          value: 0,
          duration: 0.7,
          ease: "power2.inOut",
          overwrite: "auto",
          onComplete: () => {
            item.mesh.visible = false;
            item.isHoverActive = false;
            if (item.src) {
              item.video.pause();
              item.video.currentTime = 0;
            }
          }
        });

        item.scaleTween = gsap.to(item.scale, {
          value: 1,
          duration: 0.7,
          ease: "power4.out",
          overwrite: "auto"
        });

      },
      move: (index, clientX, clientY) => {
        const item = apiRef.current.items.get(index);
        if (!item) {
          return { hit: false, x: 0, y: 0 };
        }

        const pointer = moveItemByRaycast(item, clientX, clientY);
        if (pointer.hit) {
          wakeRenderLoop();
        }
        return pointer;
      },

      // ──  ControllerThreeListItemZoom ─────────────────────────────────
      zoomIn: (index, onComplete) => {
        const item = apiRef.current.items.get(index);
        if (!item) return false;
        const api = apiRef.current;
        const rect = item.getRect();
        if (!rect) return false;

        warmStillTexture(item);

        // Kill any active hover
        item.progressTween?.kill();
        item.scaleTween?.kill();
        item.hoverStrengthTween?.kill();
        item.mesh.visible = false;
        item.scale.value = 1;
        item.hoverStrength.value = 0;

        // Create zoom mesh lazily
        if (!item.zoomMesh) {
          const zoomGeo = new THREE.PlaneGeometry(1, 1, 96, 54);
          const zoomUniforms: WorksZoomUniforms = {
            uTexture:  { value: item.stillTexture },
            uListPosition: { value: new THREE.Vector2(0, 0) },
            uListSize: { value: new THREE.Vector2(1, 1) },
            uSlideSize: { value: new THREE.Vector2(1, 1) },
            uTextureAspect: { value: 16 / 9 },
            uListAspect: { value: 16 / 9 },
            uSlideAspect: { value: 16 / 9 },
            uZoomScale: { value: 0 },
            uSway:     { value: 0 },
            uCorners:  { value: new THREE.Vector4(0, 0, 0, 0) },
            uProgress: { value: 0 },
            uTime:     { value: 0 },
          };
          const zoomMat = new THREE.ShaderMaterial({
            uniforms: zoomUniforms,
            vertexShader: cardZoomVertexShader,
            fragmentShader: cardZoomFragmentShader,
            depthWrite: false,
            depthTest: false
          });
          const zoomMesh = new THREE.Mesh(zoomGeo, zoomMat);
          zoomMesh.visible = false;
          zoomMesh.frustumCulled = false;
          api.scene?.add(zoomMesh);
          item.zoomMesh = zoomMesh;
          item.zoomUniforms = zoomUniforms;
        }

        // Raise canvas above all page content during zoom
        if (canvasRef.current) {
          canvasRef.current.style.zIndex = "999";
        }

        //  createRandomArray(4): random corner delay order
        item.zoomRandom = shuffled4();
        item.zoomFadeTargets = canvasRef.current?.parentElement
          ? Array.from(canvasRef.current.parentElement.children)
              .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== canvasRef.current)
          : [];
        item.zoomFadeTargets.forEach((target) => {
          target.style.willChange = "opacity";
          target.style.pointerEvents = "none";
        });

        warmItemVideo(item, true);

        // Keep transform neutral: the shader interpolates every vertex from list to slide.
        const startX = rect.left + rect.width / 2 - api.viewport.width / 2;
        const startY = api.viewport.height / 2 - (rect.top + rect.height / 2);
        item.zoomMesh.position.set(0, 0, 0);
        item.zoomMesh.scale.set(1, 1, 1);
        item.zoomMesh.visible = true;
        item.isZooming = true;
        wakeRenderLoop();

        // Reset progress + uniforms
        item.zoomProgress1.value = 0;
        item.zoomProgress2.value = 0;
        if (item.zoomUniforms) {
          const listAspect = rect.width / Math.max(rect.height, 1);
          const slideAspect = api.viewport.width / Math.max(api.viewport.height, 1);
          const videoTexture = ensureVideoTexture(item);
          item.zoomUniforms.uTexture.value = videoTexture ?? item.stillTexture;
          item.zoomUniforms.uListPosition.value.set(startX, startY);
          item.zoomUniforms.uListSize.value.set(rect.width, rect.height);
          item.zoomUniforms.uSlideSize.value.set(api.viewport.width * 1.02, api.viewport.height * 1.02);
          item.zoomUniforms.uTextureAspect.value = listAspect;
          item.zoomUniforms.uListAspect.value = listAspect;
          item.zoomUniforms.uSlideAspect.value = slideAspect;
          item.zoomUniforms.uZoomScale.value = Math.min(api.viewport.width, api.viewport.height) * 0.065;
          item.zoomUniforms.uSway.value = 0;
          item.zoomUniforms.uCorners.value.set(0, 0, 0, 0);
          item.zoomUniforms.uProgress.value = 0;
          item.zoomUniforms.uTime.value = (performance.now() - api.startedAt) / 1000;
        }

        if (item.src) {
          item.video.play().catch(() => {});
        }

        // : _progress1 0→0.5 in 1.2s CubicInOut, _progress2 0→0.5 in 1.5s QuadInOut
        const tl = gsap.timeline();
        item.zoomTween = tl;

        // Mesh expansion is driven in the vertex shader, corner by corner.
        //  _progress1 + _progress2 drive sway + corners via _onUpdate
        tl.to(item.zoomProgress1, { value: 0.5, duration: 1.2, ease: "power3.inOut" }, 0);
        tl.to(item.zoomProgress2, { value: 0.5, duration: 1.5, ease: "power2.inOut" }, 0);

        //  _zoomInComplete at delay 1.4s
        tl.call(() => {
          item.isZooming = false;
          if (api.renderer && api.scene && api.camera) {
            api.renderer.render(api.scene, api.camera);
          }
          if (canvasRef.current) {
            canvasRef.current.style.zIndex = "";
          }
          restoreZoomFadeTargets(item);
          if (item.zoomMesh) item.zoomMesh.visible = false;
          if (item.src) {
            item.video.pause();
          }
          onComplete();
        }, [], 1.4);
        return true;
      }
    }), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance"
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(getCanvasPixelRatio());
      renderer.setClearColor(0xffffff, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10000);
      apiRef.current.renderer = renderer;
      apiRef.current.scene = scene;
      apiRef.current.camera = camera;
      apiRef.current.items.forEach((item) => {
        if (item.mesh.parent !== scene) {
          scene.add(item.mesh);
        }
      });

      const resize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        apiRef.current.viewport.width = width;
        apiRef.current.viewport.height = height;
        const fov = 60;
        camera.aspect = width / Math.max(height, 1);
        camera.position.z = (height / 2) / Math.tan((fov * Math.PI / 180) / 2);
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(getCanvasPixelRatio());
        renderer.setSize(width, height, false);
      };

      resize();
      window.addEventListener("resize", resize);

      let disposed = false;
      let hadActiveFrame = false;
      const startedAt = performance.now();
      apiRef.current.startedAt = startedAt;
      const render = () => {
        const api = apiRef.current;
        frameIdRef.current = null;
        if (disposed) {
          return;
        }

        let hasActiveWork = false;

        api.items.forEach((item) => {
          // ── Card-click zoom: TAO ControllerThreeListItemZoom._onUpdate ─────
          if (item.isZooming && item.zoomUniforms) {
            hasActiveWork = true;
            const e = item.zoomProgress1.value + item.zoomProgress2.value; // 0→1
            const t = smoothStepZoom(0, 0.9, e);
            const sway = t < 0.5 ? 2 * t : 2 * (1 - t); // bell-curve peak at t=0.5
            const cDelays = [0, 0.1, 0.2, 0.3]; // TAO c = [0,.1,.2,.3]
            const r = item.zoomRandom;
            item.zoomUniforms.uTime.value = (performance.now() - startedAt) / 1000;
            item.zoomUniforms.uSway.value = sway;
            item.zoomUniforms.uProgress.value = t;
            item.zoomUniforms.uSlideSize.value.set(api.viewport.width * 1.02, api.viewport.height * 1.02);
            item.zoomUniforms.uSlideAspect.value = api.viewport.width / Math.max(api.viewport.height, 1);
            item.zoomUniforms.uCorners.value.set(
              smoothStepZoom(cDelays[r[0]], 0.7, e),
              smoothStepZoom(cDelays[r[1]], 0.7, e),
              smoothStepZoom(cDelays[r[2]], 0.7, e),
              smoothStepZoom(cDelays[r[3]], 0.7, e)
            );
            const listOpacity = 1 - smoothStepZoom(0.1, 0.6, e);
            item.zoomFadeTargets.forEach((target) => {
              target.style.opacity = String(listOpacity);
            });
            const zoomTexture = ensureVideoTexture(item);
            if (zoomTexture) {
              zoomTexture.needsUpdate = true;
              item.zoomUniforms.uTexture.value = zoomTexture;
            } else {
              item.zoomUniforms.uTexture.value = item.stillTexture;
            }
            return; // skip hover canvas while zooming
          }

          const shouldRenderHover =
            item.isHoverActive ||
            item.mesh.visible ||
            item.uniforms.uProgress.value > 0.001 ||
            item.hoverStrength.value > 0.001 ||
            Math.abs(item.scale.value - 1) > 0.001;

          if (!shouldRenderHover) {
            return;
          }

          hasActiveWork = true;
          const elapsed = (performance.now() - startedAt) / 1000;
          const phase = elapsed * Math.PI * 2;
          item.uniforms.uTime.value.set(
            elapsed,
            phase,
            Math.sin(phase),
            Math.cos(phase)
          );
          item.hoverCurrent.x += (item.hoverTarget.x - item.hoverCurrent.x) * 0.1;
          item.hoverCurrent.y += (item.hoverTarget.y - item.hoverCurrent.y) * 0.1;
          item.uniforms.uHover.value.set(
            (item.hoverCurrent.x + 1) * 0.5,
            1 - (item.hoverCurrent.y + 1) * 0.5,
            item.hoverStrength.value
          );

          if (!syncItemMesh(item)) {
            item.mesh.visible = false;
            item.isHoverActive = false;
            return;
          }

          const hoverTexture = ensureVideoTexture(item);
          if (hoverTexture) {
            hoverTexture.needsUpdate = true;
            item.uniforms.uTexture2.value = hoverTexture;
          } else {
            item.uniforms.uTexture2.value = item.stillTexture;
          }
        });

        if (api.renderer && api.scene && api.camera && hasActiveWork) {
          api.renderer.render(api.scene, api.camera);
          hadActiveFrame = true;
        } else if (api.renderer && hadActiveFrame) {
          api.renderer.clear();
          hadActiveFrame = false;
        }

        if (hasActiveWork && !disposed) {
          frameIdRef.current = requestAnimationFrame(render);
        }
      };

      renderLoopRef.current = () => {
        if (disposed || frameIdRef.current !== null) {
          return;
        }

        frameIdRef.current = requestAnimationFrame(render);
      };

      return () => {
        disposed = true;
        if (frameIdRef.current !== null) {
          cancelAnimationFrame(frameIdRef.current);
          frameIdRef.current = null;
        }
        renderLoopRef.current = null;
        window.removeEventListener("resize", resize);
        apiRef.current.items.forEach(destroyItem);
        apiRef.current.items.clear();
        apiRef.current.videoObserver?.disconnect();
        apiRef.current.videoObserver = null;
        renderer.dispose();
        apiRef.current.renderer = null;
        apiRef.current.scene = null;
        apiRef.current.camera = null;
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[5] h-[100dvh] w-screen"
      />
    );
  }
);
// ─── Single card ─────────────────────────────────────────────────────────────

function CenaCard({
  item,
  index,
  scrollRootRef,
  hoverCanvasRef,
  onWorkIntent,
  onWorkSelect,
  entryKey = 0,
  entryMode = "auto"
}: {
  item: WorkItem;
  index: number;
  scrollRootRef?: RefObject<HTMLElement | null>;
  hoverCanvasRef?: RefObject<WorksHoverCanvasHandle | null>;
  onWorkIntent?: (index: number) => void;
  onWorkSelect?: (index: number) => void;
  entryKey?: number;
  entryMode?: "auto" | "manual";
}) {
  const router = useRouter();
  const cardRef  = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const isHoveringRef = useRef(false);
  const isTrackingPointerRef = useRef(false);
  const isNavigatingRef = useRef(false);
  // Stable handler refs — same function object used for add AND remove
  const windowHandlersRef = useRef<{ move: ((e: MouseEvent) => void) | null; blur: (() => void) | null }>({ move: null, blur: null });

  // Per-item randoms — seeded once on mount, never change
  const zenoRef     = useRef(0);   // Tajima: Random.range(0.1, 0.15, 0.01)
  const entryDurRef = useRef(0);   // Tajima: 0.8 + Random.range(0, 0.4, 0.1)
  const offsetScaleRef = useRef(1); // Tajima: 1 + Random.ranges(0, 0.2, 0.1)

  // Parallax state
  const addY     = useRef({ value: 300 });
  const currentY = useRef(0);
  const targetY  = useRef(0);
  const rafId    = useRef<number | null>(null);
  const scrollFrameId = useRef<number | null>(null);
  const hiddenRef = useRef(false);

  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const stopPointerTracking = () => {
    if (!isTrackingPointerRef.current) {
      return;
    }

    if (windowHandlersRef.current.move) window.removeEventListener("mousemove", windowHandlersRef.current.move);
    if (windowHandlersRef.current.blur) window.removeEventListener("blur", windowHandlersRef.current.blur);
    windowHandlersRef.current = { move: null, blur: null };
    isTrackingPointerRef.current = false;
  };

  const endHover = () => {
    if (!isHoveringRef.current) {
      stopPointerTracking();
      return;
    }

    isHoveringRef.current = false;
    setIsHovering(false);
    hoverCanvasRef?.current?.leave(index);
    stopPointerTracking();

    if (motionRef.current) {
      gsap.to(motionRef.current, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "power4.out",
        overwrite: "auto"
      });
    }
  };

  const updatePointerHover = (
    clientX: number,
    clientY: number,
    allowLeave: boolean
  ) => {
    const pointer = hoverCanvasRef?.current?.move(index, clientX, clientY);

    if (allowLeave && !pointer?.hit) {
      endHover();
      return;
    }

    if (!pointer?.hit) {
      return;
    }

    if (motionRef.current) {
      gsap.killTweensOf(motionRef.current, "x,y");
      gsap.set(motionRef.current, { x: 0, y: 0 });
    }
  };

  const beginHover = (clientX: number, clientY: number) => {
    const mediaRect = mediaRef.current?.getBoundingClientRect();
    if (
      !mediaRect ||
      clientX < mediaRect.left ||
      clientX > mediaRect.right ||
      clientY < mediaRect.top ||
      clientY > mediaRect.bottom
    ) {
      return;
    }

    if (!isHoveringRef.current) {
      isHoveringRef.current = true;
      setIsHovering(true);
      hoverCanvasRef?.current?.enter(index);
    }

    if (!isTrackingPointerRef.current) {
      const moveHandler = (e: MouseEvent) => {
        const rect = mediaRef.current?.getBoundingClientRect();
        if (
          !rect ||
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          endHover();
          return;
        }

        updatePointerHover(e.clientX, e.clientY, false);
      };
      const blurHandler = () => endHover();
      windowHandlersRef.current = { move: moveHandler, blur: blurHandler };
      window.addEventListener("mousemove", moveHandler, { passive: true });
      window.addEventListener("blur", blurHandler);
      isTrackingPointerRef.current = true;
    }

    updatePointerHover(clientX, clientY, false);
  };

  useEffect(() => {
    const hoverCanvas = hoverCanvasRef?.current;
    if (!hoverCanvas) {
      return;
    }

    hoverCanvas.register(index, item.src, item.poster, () => {
      const rect = mediaRef.current?.getBoundingClientRect();
      if (!rect) {
        return null;
      }

      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    }, () => {
      return mediaRef.current?.querySelector("img") ?? null;
    });

    // Lazy-load video: src is assigned only when card scrolls into view
    if (cardRef.current) {
      hoverCanvas.observeCard(index, cardRef.current);
    }

    return () => {
      stopPointerTracking();
      hoverCanvas.unregister(index);
    };
  }, [hoverCanvasRef, index, item.poster, item.src]);

  useEffect(() => {
    const card  = cardRef.current;
    if (!card) return;
    const layoutHost = card.parentElement ?? card;

    // Seed per-item randoms
    zenoRef.current     = randRange(10, 15, 1) / 100;   // 0.10 – 0.15
    entryDurRef.current = 0.8 + randRange(0, 4, 1) / 10; // 0.8 – 1.2 s
    offsetScaleRef.current = 1 + randRange(0, 2, 1) / 10; // 1.0 – 1.2

    const obj = addY.current;
    const entryOffset = entryMode === "manual" ? 400 : 300;
    obj.value = entryOffset;
    hiddenRef.current = false;
    card.style.visibility = "visible";
    card.style.pointerEvents = "";
    gsap.set(card, { opacity: 1, y: entryOffset });

    // ─────────────────────────────────────────────────────────────────────
    // 1. ENTRY — addY 300→0, power4.out, RANDOM duration per item
    //    Tajima: TweenMax.to(o, 0.8+rand(0,0.4,0.1), {addY:0, ease:QuartOut})
    //    All items fire simultaneously on mount (exactly like Tajima _onStart)
    // ─────────────────────────────────────────────────────────────────────
    if (entryMode === "auto") {
      tweenRef.current = gsap.to(obj, {
        value: 0,
        duration: entryDurRef.current,
        ease: "power4.out",
        onUpdate: () => {
          gsap.set(card, { y: currentY.current + obj.value });
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. PARALLAX — layout-driven TAO scroll controller.
    //    TAO measures the fixed list layout, hides offscreen items, and
    //    re-enters from directional offsets before the zeno settle.
    // ─────────────────────────────────────────────────────────────────────
    const tick = () => {
      const delta = targetY.current - currentY.current;
      if (Math.abs(delta) < 0.2) {
        currentY.current = targetY.current;
        rafId.current = null;
      } else {
        currentY.current += delta * zenoRef.current;
        rafId.current = requestAnimationFrame(tick);
      }
      gsap.set(card, { y: currentY.current + addY.current.value });
    };

    const setHidden = (hidden: boolean) => {
      hiddenRef.current = hidden;
      card.style.visibility = hidden ? "hidden" : "visible";
      card.style.opacity = hidden ? "0" : "1";
      card.style.pointerEvents = hidden ? "none" : "";
    };

    const getViewport = () => {
      const scrollRoot = scrollRootRef?.current;

      if (scrollRoot) {
        const rect = scrollRoot.getBoundingClientRect();
        return {
          height: scrollRoot.clientHeight || window.innerHeight,
          scrollY: scrollRoot.scrollTop,
          top: rect.top
        };
      }

      return {
        height: window.innerHeight,
        scrollY: window.scrollY,
        top: 0
      };
    };

    const getDirectionalOffset = (height: number) => {
      const width = window.innerWidth;
      const baseOffset = width < 768 ? 200 : width < 1024 ? 250 : 500;
      const scaledOffset = baseOffset * offsetScaleRef.current;

      return {
        max: scaledOffset,
        min: -scaledOffset,
        seed: (height / 3) * 0.25
      };
    };

    const stopTick = () => {
      if (rafId.current === null) {
        return;
      }

      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };

    const updateScrollTarget = () => {
      const viewport = getViewport();
      const layoutRect = layoutHost.getBoundingClientRect();
      const layoutTop = viewport.scrollY + layoutRect.top - viewport.top;
      const height = layoutRect.height || card.offsetHeight;
      const position = layoutTop - viewport.height / 2 + height / 2;
      const min = layoutTop - viewport.height;
      const max = layoutTop + height;
      const offsets = getDirectionalOffset(viewport.height);
      let distance = position - viewport.scrollY;

      if (viewport.scrollY > max || viewport.scrollY < min) {
        if (hiddenRef.current) {
          return;
        }

        setHidden(true);
        currentY.current = offsets.seed + (viewport.scrollY < min ? offsets.max : offsets.min);
        targetY.current = currentY.current;
        gsap.set(card, { y: currentY.current + addY.current.value });
        stopTick();
        return;
      }

      if (hiddenRef.current) {
        setHidden(false);
        currentY.current = offsets.seed + (distance > 0 ? offsets.max : offsets.min);
        gsap.set(card, { y: currentY.current + addY.current.value });
      }

      const area = Math.max(viewport.height / 4, 100);

      if (distance > 0) {
        distance = distance < area ? 0 : distance - area;
      } else if (distance < 0) {
        distance = distance > -area ? 0 : distance + area;
      }

      targetY.current = distance * 0.25;

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (scrollFrameId.current !== null) {
        return;
      }

      scrollFrameId.current = requestAnimationFrame(() => {
        scrollFrameId.current = null;
        updateScrollTarget();
      });
    };

    const scrollRoot = scrollRootRef?.current;
    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;

    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateScrollTarget();

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      stopTick();
      if (scrollFrameId.current !== null) {
        cancelAnimationFrame(scrollFrameId.current);
        scrollFrameId.current = null;
      }
      tweenRef.current?.kill();
    };
  }, [entryMode, scrollRootRef]);

  useEffect(() => {
    if (entryMode !== "manual" || entryKey === 0) {
      return;
    }

    const card = cardRef.current;

    if (!card) {
      return;
    }

    const obj = addY.current;
    tweenRef.current?.kill();
    obj.value = 400;
    gsap.set(card, { opacity: 1, y: currentY.current + obj.value });

    tweenRef.current = gsap.to(obj, {
      value: 0,
      duration: entryDurRef.current,  /* TAO: 0.8–1.2s random, seeded per-card on mount */
      ease: "expo.out",
      onUpdate: () => {
        gsap.set(card, { y: currentY.current + obj.value });
      }
    });
  }, [entryKey, entryMode]);

  // ─────────────────────────────────────────────────────────────────────
  // 3. HOVER — CSS  WebGL ±16px + scale 1.25
  // ─────────────────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isHoveringRef.current) {
      return;
    }

    beginHover(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    endHover();
  };

  return (
    <div
      ref={cardRef}
      onClick={() => {
        if (isNavigatingRef.current) {
          return;
        }

        isNavigatingRef.current = true;
        endHover();
        const path = worksPath(item);
        onWorkIntent?.(index);

        const finish = () => {
          routeManagerPlus.goto(path, null, true);

          if (onWorkSelect) {
            onWorkSelect(index);
            window.setTimeout(() => {
              isNavigatingRef.current = false;
            }, 120);
            return;
          }

          router.replace(path);
          window.setTimeout(() => {
            isNavigatingRef.current = false;
          }, 120);
        };
        const started = hoverCanvasRef?.current?.zoomIn(index, finish) ?? false;
        if (!started) finish();
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={(e) => {
        beginHover(e.clientX, e.clientY);
      }}
      className="group cursor-pointer will-change-transform"
      style={{ opacity: 0, transform: "translateY(300px)" }}
      data-no-trail
      data-cursor="hover"
      data-work-index={index}
    >
      {/* ── Number (above thumb — Tajima: .list_num) ──────────────────── */}
      <div ref={motionRef} className="will-change-transform">
      <div className="relative z-0 h-[27px] overflow-hidden select-none">
        <span
          className={`block text-[21px] font-semibold leading-[27px] tracking-[0.02em] text-[#171411] transition-transform duration-500 ease-[cubic-bezier(0.215,0.61,0.355,1)] ${isHovering ? "translate-y-[27px] delay-0" : "delay-100"}`}
          style={tajimaSerifStyle}
        >
          {item.id}
        </span>
      </div>

      {/* ── Thumbnail — landscape 16:9  ─────────────────── */}
      <div
        ref={mediaRef}
        className="relative isolate overflow-visible bg-[#e8e6e3]"
        style={{ aspectRatio: "16 / 9" }}
        data-work-media-index={index}
      >
        <img
          src={item.poster}
          alt=""
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity ${isHovering ? "opacity-0 delay-0 duration-100 ease-linear" : "opacity-100 delay-500 duration-200 ease-[cubic-bezier(0.39,0.575,0.565,1)]"}`}
        />
      </div>

      {/* ── Title : .list_title — light, ~14px, no italic) ──────────────── */}
      <div className="mt-[6px] overflow-hidden">
        <span
          className={`block text-[18px] font-semibold leading-[1.18] tracking-[0.01em] text-[#171411] md:text-[19px] transition-transform duration-500 ease-[cubic-bezier(0.215,0.61,0.355,1)] ${isHovering ? "-translate-y-[120%] delay-0" : "delay-100"}`}
          style={tajimaSerifStyle}
        >
          {item.title}
        </span>
      </div>

      {/* ── Category + Year (Tajima: .list_category) ────────────────────── */}
      <div className="hidden">
        <span className={`block font-mono text-[10px] font-normal uppercase leading-[1.5] tracking-[0.25em] text-[#999] transition-transform duration-500 ease-[cubic-bezier(0.215,0.61,0.355,1)] ${isHovering ? "-translate-y-[120%] delay-[30ms]" : "delay-[130ms]"}`}>
          {item.category}
        </span>
      </div>
    </div>
  </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

type CenasGridSectionProps = {
  onHomeClick?: () => void;
  onWorkIntent?: (index: number) => void;
  onWorkSelect?: (index: number) => void;
  scrollRootRef?: RefObject<HTMLElement | null>;
  entryKey?: number;
  entryMode?: "auto" | "manual";
};

export function CenasGridSection({
  onHomeClick,
  onWorkIntent,
  onWorkSelect,
  scrollRootRef,
  entryKey = 0,
  entryMode = "auto"
}: CenasGridSectionProps = {}) {
  const listRef     = useRef<HTMLDivElement>(null);
  const headerRef   = useRef<HTMLDivElement>(null);
  const sectionRef  = useRef<HTMLElement>(null);
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hoverCanvasRef = useRef<WorksHoverCanvasHandle>(null);
  const router = useRouter();
  const isEmbedded = Boolean(onHomeClick);

  // ─      (): JS absolute positioning ─────────────────────────────
  // 2 cols: h=[50,0], colGap=100px
  // 3 cols (≥1100px): h=[50,0,100], colGap=60px
  // Per-item vertical gap:  measured first rows, then randRange(80,130,10)
  // Container height = Math.max(...h)
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    // First rows pinned to  measurements; fallback stays in random range.
    const tajimaMeasuredGaps = [130, 90, 90, 90, 110, 80];
    const gaps: number[] = WORKS.map((_, index) => tajimaMeasuredGaps[index] ?? randRange(80, 130, 10));

    const layout = () => {
      const W       = list.clientWidth;
      const cols    = W >= 1095 ? 3 : W >= 540 ? 2 : 1;
      const colGap  = cols === 3 ? 60 : cols === 2 ? 100 : 0;
      const itemW   = Math.floor((W - colGap * (cols - 1)) / cols);
      const h       = cols === 3 ? [50, 0, 100] : cols === 2 ? [50, 0] : [0];

      const wrappers = wrapperRefs.current.filter(Boolean) as HTMLDivElement[];
      wrappers.forEach((wrapper, idx) => {
        const col = idx % cols;
        wrapper.style.width    = `${itemW}px`;
        wrapper.style.left     = `${col * (itemW + colGap)}px`;
        wrapper.style.top      = `${h[col]}px`;
        wrapper.style.position = "absolute";
        // offsetHeight triggers reflow → accurate height after width set
        h[col] += wrapper.offsetHeight + gaps[idx];
      });

      list.style.height = `${Math.max(...h)}px`;
    };

    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, []);

  // ──  list_home parallax: top = 120 - scrollY ───────────────────────
  // Header floats down on load, moves up and fades out as user scrolls
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const onScroll = () => {
      const sy = scrollRootRef?.current?.scrollTop ?? window.scrollY;
      header.style.transform = `translateY(${Math.max(-30, 60 - sy * 0.65)}px)`;
      header.style.opacity   = String(Math.max(0, 1 - sy / 180));
    };

    onScroll();
    const scrollRoot = scrollRootRef?.current;
    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });

    return () => scrollTarget.removeEventListener("scroll", onScroll);
  }, [scrollRootRef]);

  // ── Section fade-in on mount (Tajima: autoAlpha 0→1, 0.5s) ──────────────
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (entryMode === "manual") {
      gsap.set(section, { opacity: 1 });
      return;
    }
    gsap.to(section, { opacity: 1, duration: 0.5, ease: "power1.out", delay: 0.05 });
  }, [entryMode]);

  return (
    <section
      ref={sectionRef}
      id="scenes"
      className="relative bg-white"
      style={{ opacity: 0, paddingBottom: "clamp(140px, 18vw, 220px)" }}
    >
      {/* ── Works page header (Tajima list_home) ──────────────────────── */}
      <GlobalWorksHoverCanvas ref={hoverCanvasRef} />

      {!isEmbedded && (
        <div
          ref={headerRef}
          className="fixed top-0 left-0 w-full z-40 pointer-events-none"
          style={{ transform: "translateY(60px)" }}
        >
          <div className="max-w-[1080px] mx-auto px-8 md:px-14 pt-10 flex items-start justify-between">
            <div className="pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  gsap.to(sectionRef.current, {
                    opacity: 0,
                    duration: 0.38,
                    ease: "power2.in",
                    onComplete: () => router.push("/"),
                  });
                }}
                className="inline-flex items-center gap-4 font-mono text-[9px] tracking-[0.44em] uppercase text-[#999] hover:text-[#333] transition-colors duration-300"
              >
                <span className="block h-px w-9 bg-current" />
                Home
              </button>
            </div>
            <div className="text-right">
              <p className="font-mono text-[9px] tracking-[0.44em] uppercase text-[#999]">Works</p>
              <p className="font-mono text-[9px] tracking-[0.44em] text-[#bbb] mt-1">
                {String(WORKS.length).padStart(2, "0")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Item grid ──────────────────────────────────────────────────── */}
      <div
        className="mx-auto w-[min(calc(100vw-56px),1095px)]"
        style={{ paddingTop: "120px" }}
      >
        {/*
          Container: position:relative, height set by _layout() JS.
          Each wrapper: position:absolute, left/top/width set by _layout().
          Items start opacity:0 so pre-layout state is never visible.
        */}
        <div ref={listRef} className="relative w-full">
          {WORKS.map((item, i) => (
            <div
              key={item.id}
              ref={(el) => { wrapperRefs.current[i] = el; }}
            >
              <CenaCard
                item={item}
                index={i}
                scrollRootRef={scrollRootRef}
                hoverCanvasRef={hoverCanvasRef}
                onWorkIntent={onWorkIntent}
                onWorkSelect={onWorkSelect}
                entryKey={entryKey}
                entryMode={entryMode}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
