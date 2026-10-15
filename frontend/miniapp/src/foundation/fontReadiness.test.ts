import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PlatformFontReadinessError,
  createPlatformFontReadinessController,
  resolvePlatformFontReadinessFeedback,
  type PlatformFontReadinessEnvironment,
  type PlatformFontResourceDescriptor,
} from './fontReadiness';

const RESOURCE: PlatformFontResourceDescriptor = Object.freeze({
  family: 'Test Font',
  requiredFaces: Object.freeze([
    Object.freeze({ style: 'normal' as const, weight: 400 }),
    Object.freeze({ style: 'normal' as const, weight: 700 }),
  ]),
  resourceId: 'TEST_LOCAL_FONT',
  sources: Object.freeze([
    Object.freeze({
      style: 'normal' as const,
      unicodeRange: 'U+0000-00FF',
      url: '/assets/test.woff2',
      weightRange: '400 700',
    }),
  ]),
  specimen: 'Test 0123',
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function harness() {
  let visible = true;
  const visibilityListeners = new Set<() => void>();
  const attempts: ReturnType<typeof deferred>[] = [];
  const environment: PlatformFontReadinessEnvironment = Object.freeze({
    clearTimer: (handle) => globalThis.clearTimeout(handle),
    isVisible: () => visible,
    loadAttempt: vi.fn(async () => {
      const attempt = deferred();
      attempts.push(attempt);
      return attempt.promise;
    }),
    now: () => Date.now(),
    preloadSource: vi.fn(),
    setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    subscribeVisibility: (listener) => {
      visibilityListeners.add(listener);
      return () => visibilityListeners.delete(listener);
    },
  });
  return {
    attempts,
    environment,
    setVisible(next: boolean) {
      visible = next;
      for (const listener of visibilityListeners) listener();
    },
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('platform font readiness lifecycle', () => {
  it('reaches READY on a fast load without entering SLOW', async () => {
    vi.useFakeTimers();
    const target = harness();
    const controller = createPlatformFontReadinessController({
      environment: target.environment,
      resource: RESOURCE,
    });
    controller.start();
    expect(controller.getSnapshot()).toMatchObject({ attempt: 1, state: 'LOADING' });
    target.attempts[0].resolve();
    await settle();
    expect(controller.getSnapshot()).toEqual({
      attempt: 1,
      diagnosticCode: null,
      state: 'READY',
    });
    controller.dispose();
  });

  it('treats 3000 ms as SLOW and opens automatically after late success', async () => {
    vi.useFakeTimers();
    const target = harness();
    const controller = createPlatformFontReadinessController({
      environment: target.environment,
      resource: RESOURCE,
      slowThresholdMs: 3_000,
    });
    controller.start();
    vi.advanceTimersByTime(3_000);
    expect(controller.getSnapshot()).toEqual({
      attempt: 1,
      diagnosticCode: 'PLATFORM_FONT_READINESS_SLOW',
      state: 'SLOW',
    });
    target.attempts[0].resolve();
    await settle();
    expect(controller.getSnapshot().state).toBe('READY');
    controller.dispose();
  });

  it('starts a fresh retry after rejection and exposes no raw error text', async () => {
    vi.useFakeTimers();
    const target = harness();
    const controller = createPlatformFontReadinessController({
      environment: target.environment,
      resource: RESOURCE,
    });
    controller.start();
    target.attempts[0].reject(new Error('net::ERR_FAILED /secret/font.woff2'));
    await settle();
    expect(controller.getSnapshot()).toEqual({
      attempt: 1,
      diagnosticCode: 'PLATFORM_FONT_LOAD_REJECTED',
      state: 'LOAD_REJECTED',
    });
    expect(resolvePlatformFontReadinessFeedback(controller.getSnapshot()))
      .toEqual({
        kind: 'recoverable-error',
        message: 'Не удалось загрузить оформление приложения. Проверьте соединение и повторите.',
        retryAllowed: true,
      });
    controller.retry();
    expect(target.attempts).toHaveLength(2);
    expect(controller.getSnapshot()).toMatchObject({ attempt: 2, state: 'RETRYING' });
    target.attempts[1].resolve();
    await settle();
    expect(controller.getSnapshot()).toEqual({
      attempt: 2,
      diagnosticCode: 'PLATFORM_FONT_READINESS_RECOVERED',
      state: 'READY_AFTER_RETRY',
    });
    controller.dispose();
  });

  it('accepts the first successful attempt when a slow original and retry overlap', async () => {
    vi.useFakeTimers();
    const target = harness();
    const controller = createPlatformFontReadinessController({
      environment: target.environment,
      resource: RESOURCE,
      slowThresholdMs: 1_000,
    });
    controller.start();
    vi.advanceTimersByTime(1_000);
    controller.retry();
    target.attempts[0].resolve();
    await settle();
    expect(controller.getSnapshot().state).toBe('READY_AFTER_RETRY');
    controller.dispose();
  });

  it('does not consume the visible slow budget while the page is hidden', () => {
    vi.useFakeTimers();
    const target = harness();
    target.setVisible(false);
    const controller = createPlatformFontReadinessController({
      environment: target.environment,
      resource: RESOURCE,
      slowThresholdMs: 3_000,
    });
    controller.start();
    vi.advanceTimersByTime(10_000);
    expect(controller.getSnapshot().state).toBe('LOADING');
    target.setVisible(true);
    vi.advanceTimersByTime(2_999);
    expect(controller.getSnapshot().state).toBe('LOADING');
    vi.advanceTimersByTime(1);
    expect(controller.getSnapshot().state).toBe('SLOW');
    controller.dispose();
  });

  it('preserves a typed missing-face diagnostic for evidence', async () => {
    vi.useFakeTimers();
    const target = harness();
    const controller = createPlatformFontReadinessController({
      environment: target.environment,
      resource: RESOURCE,
    });
    controller.start();
    target.attempts[0].reject(
      new PlatformFontReadinessError('PLATFORM_FONT_FACE_MISSING'),
    );
    await settle();
    expect(controller.getSnapshot()).toMatchObject({
      diagnosticCode: 'PLATFORM_FONT_FACE_MISSING',
      state: 'LOAD_REJECTED',
    });
    controller.dispose();
  });
});
