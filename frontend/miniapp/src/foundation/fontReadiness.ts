import { useSyncExternalStore } from 'react';
import { preload } from 'react-dom';

export const PLATFORM_FONT_READINESS_STATES = Object.freeze([
  'INITIAL',
  'LOADING',
  'SLOW',
  'READY',
  'LOAD_REJECTED',
  'RETRYING',
  'READY_AFTER_RETRY',
] as const);

export type PlatformFontReadinessState =
  typeof PLATFORM_FONT_READINESS_STATES[number];

export const PLATFORM_FONT_DIAGNOSTIC_CODES = Object.freeze([
  'PLATFORM_FONT_READINESS_SLOW',
  'PLATFORM_FONT_API_UNAVAILABLE',
  'PLATFORM_FONT_LOAD_REJECTED',
  'PLATFORM_FONT_FACE_MISSING',
  'PLATFORM_FONT_READINESS_RETRYING',
  'PLATFORM_FONT_READINESS_RECOVERED',
] as const);

export type PlatformFontDiagnosticCode =
  typeof PLATFORM_FONT_DIAGNOSTIC_CODES[number];

export type PlatformFontRequiredFace = Readonly<{
  style: 'normal' | 'italic';
  weight: number;
}>;

export type PlatformFontSource = Readonly<{
  style: 'normal' | 'italic';
  unicodeRange: string;
  url: string;
  weightRange: string;
}>;

export type PlatformFontResourceDescriptor = Readonly<{
  family: string;
  requiredFaces: readonly PlatformFontRequiredFace[];
  resourceId: string;
  sources: readonly PlatformFontSource[];
  specimen: string;
}>;

export type PlatformFontReadinessSnapshot = Readonly<{
  attempt: number;
  diagnosticCode: PlatformFontDiagnosticCode | null;
  state: PlatformFontReadinessState;
}>;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type PlatformFontReadinessEnvironment = Readonly<{
  clearTimer: (handle: TimerHandle) => void;
  isVisible: () => boolean;
  loadAttempt: (
    resource: PlatformFontResourceDescriptor,
    attempt: number,
  ) => Promise<void>;
  now: () => number;
  preloadSource: (source: PlatformFontSource) => void;
  setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  subscribeVisibility: (listener: () => void) => () => void;
}>;

export type PlatformFontReadinessController = Readonly<{
  dispose: () => void;
  getSnapshot: () => PlatformFontReadinessSnapshot;
  retry: () => void;
  start: () => void;
  subscribe: (listener: () => void) => () => void;
}>;

export class PlatformFontReadinessError extends Error {
  readonly code: PlatformFontDiagnosticCode;

  constructor(code: PlatformFontDiagnosticCode) {
    super(code);
    this.name = 'PlatformFontReadinessError';
    this.code = code;
    Object.freeze(this);
  }
}

const INITIAL_SNAPSHOT: PlatformFontReadinessSnapshot = Object.freeze({
  attempt: 0,
  diagnosticCode: null,
  state: 'INITIAL',
});

function weightRangeCovers(weightRange: string, weight: number): boolean {
  const weights = weightRange.trim().split(/\s+/).map(Number);
  if (weights.some((weight) => !Number.isFinite(weight))) return false;
  if (weights.length === 1) return weights[0] === weight;
  if (weights.length !== 2) return false;
  return weight >= weights[0] && weight <= weights[1];
}

function fontDeclaration(
  family: string,
  face: PlatformFontRequiredFace,
): string {
  return `${face.style} ${face.weight} 16px ${JSON.stringify(family)}`;
}

function loadedFaceCovers(
  loadedFace: FontFace,
  required: PlatformFontRequiredFace,
): boolean {
  return loadedFace.status === 'loaded' &&
    loadedFace.style === required.style &&
    weightRangeCovers(loadedFace.weight, required.weight);
}

async function loadBrowserAttempt(
  resource: PlatformFontResourceDescriptor,
  attempt: number,
): Promise<void> {
  if (typeof document === 'undefined') return;
  if (document.fonts === undefined || typeof FontFace === 'undefined') {
    throw new PlatformFontReadinessError('PLATFORM_FONT_API_UNAVAILABLE');
  }
  if (attempt === 1) {
    const loadedFaces = await Promise.all(resource.requiredFaces.map((face) =>
      document.fonts.load(
        fontDeclaration(resource.family, face),
        resource.specimen,
      )));
    if (loadedFaces.some((faces) => faces.length === 0)) {
      throw new PlatformFontReadinessError('PLATFORM_FONT_FACE_MISSING');
    }
    return;
  }
  const loadableFaces = resource.sources.flatMap((source) =>
    resource.requiredFaces
      .filter((required) =>
        required.style === source.style &&
        weightRangeCovers(source.weightRange, required.weight))
      .map((required) => {
        const retryUrl = new URL(source.url, document.baseURI);
        retryUrl.searchParams.set('peaks-font-attempt', String(attempt));
        return new FontFace(
          resource.family,
          `url(${JSON.stringify(retryUrl.href)}) format("woff2")`,
          {
            style: required.style,
            unicodeRange: source.unicodeRange,
            weight: String(required.weight),
          },
        );
      }));
  const loaded = await Promise.all(loadableFaces.map((face) => face.load()));
  for (const face of loaded) document.fonts.add(face);
  if (resource.requiredFaces.some((required) =>
    !loaded.some((face) => loadedFaceCovers(face, required)))) {
    throw new PlatformFontReadinessError('PLATFORM_FONT_FACE_MISSING');
  }
}

function defaultEnvironment(): PlatformFontReadinessEnvironment {
  return Object.freeze({
    clearTimer: (handle: TimerHandle) => globalThis.clearTimeout(handle),
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    loadAttempt: loadBrowserAttempt,
    now: () => typeof performance === 'undefined' ? Date.now() : performance.now(),
    preloadSource: (source: PlatformFontSource) => preload(source.url, {
      as: 'font',
      crossOrigin: 'anonymous',
      type: 'font/woff2',
    }),
    setTimer: (callback: () => void, delayMs: number) =>
      globalThis.setTimeout(callback, delayMs),
    subscribeVisibility: (listener: () => void) => {
      if (typeof document === 'undefined') return () => undefined;
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  });
}

function diagnosticFrom(error: unknown): PlatformFontDiagnosticCode {
  return error instanceof PlatformFontReadinessError
    ? error.code
    : 'PLATFORM_FONT_LOAD_REJECTED';
}

export function createPlatformFontReadinessController(input: Readonly<{
  environment?: PlatformFontReadinessEnvironment;
  resource: PlatformFontResourceDescriptor;
  slowThresholdMs?: number;
}>): PlatformFontReadinessController {
  const environment = input.environment ?? defaultEnvironment();
  const slowThresholdMs = input.slowThresholdMs ?? 3_000;
  if (!Number.isFinite(slowThresholdMs) || slowThresholdMs <= 0) {
    throw new Error('PLATFORM_FONT_SLOW_THRESHOLD_INVALID');
  }
  let snapshot = INITIAL_SNAPSHOT;
  let disposed = false;
  let nextAttempt = 0;
  let remainingVisibleMs = slowThresholdMs;
  let visibleSince: number | null = null;
  let slowTimer: TimerHandle | null = null;
  const activeAttempts = new Set<number>();
  const listeners = new Set<() => void>();

  const publish = (
    state: PlatformFontReadinessState,
    diagnosticCode: PlatformFontDiagnosticCode | null,
  ): void => {
    if (disposed) return;
    snapshot = Object.freeze({
      attempt: nextAttempt,
      diagnosticCode,
      state,
    });
    for (const listener of listeners) listener();
  };

  const clearSlowTimer = (): void => {
    if (slowTimer !== null) environment.clearTimer(slowTimer);
    slowTimer = null;
    visibleSince = null;
  };

  const armSlowTimer = (): void => {
    if (
      disposed ||
      slowTimer !== null ||
      !environment.isVisible() ||
      !['LOADING', 'RETRYING'].includes(snapshot.state)
    ) return;
    visibleSince = environment.now();
    slowTimer = environment.setTimer(() => {
      slowTimer = null;
      visibleSince = null;
      remainingVisibleMs = 0;
      publish('SLOW', 'PLATFORM_FONT_READINESS_SLOW');
    }, remainingVisibleMs);
  };

  const onVisibilityChange = (): void => {
    if (disposed || !['LOADING', 'RETRYING'].includes(snapshot.state)) return;
    if (!environment.isVisible()) {
      if (slowTimer !== null && visibleSince !== null) {
        environment.clearTimer(slowTimer);
        slowTimer = null;
        remainingVisibleMs = Math.max(
          0,
          remainingVisibleMs - (environment.now() - visibleSince),
        );
        visibleSince = null;
      }
      return;
    }
    if (remainingVisibleMs === 0) {
      publish('SLOW', 'PLATFORM_FONT_READINESS_SLOW');
      return;
    }
    armSlowTimer();
  };

  const unsubscribeVisibility = environment.subscribeVisibility(
    onVisibilityChange,
  );

  const launch = (retry: boolean): void => {
    if (disposed) return;
    nextAttempt += 1;
    const attempt = nextAttempt;
    activeAttempts.add(attempt);
    remainingVisibleMs = slowThresholdMs;
    clearSlowTimer();
    publish(
      retry ? 'RETRYING' : 'LOADING',
      retry ? 'PLATFORM_FONT_READINESS_RETRYING' : null,
    );
    armSlowTimer();
    let load: Promise<void>;
    try {
      if (!retry) {
        for (const source of input.resource.sources) {
          environment.preloadSource(source);
        }
      }
      load = environment.loadAttempt(input.resource, attempt);
    } catch (error: unknown) {
      load = Promise.reject(error);
    }
    void load.then(
      () => {
        activeAttempts.delete(attempt);
        if (disposed || ['READY', 'READY_AFTER_RETRY'].includes(snapshot.state)) {
          return;
        }
        clearSlowTimer();
        publish(
          nextAttempt > 1 ? 'READY_AFTER_RETRY' : 'READY',
          nextAttempt > 1 ? 'PLATFORM_FONT_READINESS_RECOVERED' : null,
        );
      },
      (error: unknown) => {
        activeAttempts.delete(attempt);
        if (
          disposed ||
          ['READY', 'READY_AFTER_RETRY'].includes(snapshot.state) ||
          activeAttempts.size > 0
        ) return;
        clearSlowTimer();
        publish('LOAD_REJECTED', diagnosticFrom(error));
      },
    );
  };

  return Object.freeze({
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearSlowTimer();
      activeAttempts.clear();
      listeners.clear();
      unsubscribeVisibility();
    },
    getSnapshot: () => snapshot,
    retry: () => {
      if (!['SLOW', 'LOAD_REJECTED'].includes(snapshot.state)) return;
      launch(true);
    },
    start: () => {
      if (snapshot.state !== 'INITIAL') return;
      launch(false);
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export function usePlatformFontReadiness(
  controller: PlatformFontReadinessController,
): PlatformFontReadinessSnapshot {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
}

export type PlatformFontReadinessFeedback = Readonly<{
  kind: 'loading' | 'recoverable-error';
  message: string;
  retryAllowed: boolean;
}>;

export function resolvePlatformFontReadinessFeedback(
  snapshot: PlatformFontReadinessSnapshot,
): PlatformFontReadinessFeedback | null {
  if (snapshot.state === 'READY' || snapshot.state === 'READY_AFTER_RETRY') {
    return null;
  }
  if (snapshot.state === 'SLOW') {
    return Object.freeze({
      kind: 'recoverable-error',
      message: 'Загрузка интерфейса занимает больше времени. Можно подождать или повторить.',
      retryAllowed: true,
    });
  }
  if (snapshot.state === 'LOAD_REJECTED') {
    return Object.freeze({
      kind: 'recoverable-error',
      message: 'Не удалось загрузить оформление приложения. Проверьте соединение и повторите.',
      retryAllowed: true,
    });
  }
  return Object.freeze({
    kind: 'loading',
    message: snapshot.state === 'RETRYING'
      ? 'Повторно загружаем оформление приложения.'
      : 'Загружаем оформление приложения.',
    retryAllowed: false,
  });
}
