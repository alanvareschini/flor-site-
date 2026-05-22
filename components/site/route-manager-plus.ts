"use client";

import {
  ABOUT_PATH,
  PATH_LIST,
  ROOT_PATH,
  WORKS_PATH,
  WORK_PATHS
} from "@/data/works";

export type RouteState = {
  path: string;
  hash: string;
  pop: boolean;
};

type RouteListener = (state: RouteState) => void;

function normalizePath(path: string) {
  const cleanPath = (path || ROOT_PATH).split("#")[0].split("?")[0] || ROOT_PATH;
  const withSlash = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  return withSlash === ROOT_PATH || withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

function normalizeHash(hash: string | null) {
  return (hash ?? "").replace(/^#/, "");
}

function routeKey(path: string, hash: string) {
  return `${path}${hash ? `#${hash}` : ""}`;
}

class RouteManagerPlus {
  private state: RouteState = {
    path: ROOT_PATH,
    hash: "",
    pop: false
  };

  private listeners = new Set<RouteListener>();
  private initCount = 0;
  private listening = false;
  private readonly onPopState = () => this.route(true);

  init() {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    this.initCount += 1;
    this.route(false);

    if (!this.listening) {
      window.addEventListener("popstate", this.onPopState);
      this.listening = true;
    }

    return () => {
      this.initCount = Math.max(0, this.initCount - 1);

      if (this.initCount === 0 && this.listening) {
        window.removeEventListener("popstate", this.onPopState);
        this.listening = false;
      }
    };
  }

  current() {
    return { ...this.state };
  }

  get<K extends keyof RouteState>(key: K) {
    return this.state[key];
  }

  onChange(listener: RouteListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  validate(path: string, hash: string | null = null) {
    void hash;
    return PATH_LIST.includes(normalizePath(path));
  }

  goto(path: string, hash: string | null = null, pop = false) {
    if (typeof window === "undefined") {
      return false;
    }

    const nextPath = normalizePath(path);
    const nextHash = normalizeHash(hash);

    if (!this.validate(nextPath, nextHash)) {
      return false;
    }

    const nextKey = routeKey(nextPath, nextHash);
    const currentKey = routeKey(normalizePath(window.location.pathname), normalizeHash(window.location.hash));

    if (nextKey !== currentKey) {
      window.history.pushState(
        { florAlvaRoute: true, path: nextPath, hash: nextHash, pop },
        "",
        nextKey
      );
    }

    this.setState({ path: nextPath, hash: nextHash, pop });
    return true;
  }

  isList(path = this.state.path) {
    const normalized = normalizePath(path);
    return normalized === WORKS_PATH || normalized === ABOUT_PATH;
  }

  isSlide(path = this.state.path) {
    return !this.isList(path);
  }

  getWorksIndexByPath(path: string) {
    return WORK_PATHS.indexOf(normalizePath(path));
  }

  getSlideIndexByPath(path: string) {
    const normalized = normalizePath(path);

    if (this.isList(normalized)) {
      return -1;
    }

    if (normalized === ROOT_PATH) {
      return 0;
    }

    const workIndex = this.getWorksIndexByPath(normalized);
    return workIndex >= 0 ? workIndex + 1 : -1;
  }

  getPathBySlideIndex(index: number) {
    if (index <= 0) {
      return ROOT_PATH;
    }

    return WORK_PATHS[index - 1] ?? ROOT_PATH;
  }

  gotoSlide(index: number, pop = false) {
    return this.goto(this.getPathBySlideIndex(index), null, pop);
  }

  private route(pop: boolean) {
    if (typeof window === "undefined") {
      return;
    }

    const path = normalizePath(window.location.pathname);
    const hash = normalizeHash(window.location.hash);
    this.setState({ path, hash, pop });
  }

  private setState(nextState: RouteState) {
    this.state = nextState;
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }
}

export const routeManagerPlus = new RouteManagerPlus();
