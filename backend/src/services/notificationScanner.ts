import type { NotificationResult } from './notifications.js';

export const NOTIFICATION_SCANNER_INTERVAL_MS = 60_000;

export type NotificationScannerStatus = Readonly<{
  running: boolean;
  runCount: number;
  failureCount: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastResultId: string | null;
}>;

type TimerHandle = ReturnType<typeof setInterval>;

export type NotificationScanner = Readonly<{
  start: () => void;
  stop: () => void;
  trigger: () => Promise<void>;
  status: () => NotificationScannerStatus;
}>;

export function createNotificationScanner(input: Readonly<{
  scan: () => Promise<NotificationResult>;
  onSuccess: (status: NotificationScannerStatus) => void;
  onFailure: (error: unknown, status: NotificationScannerStatus) => void;
  now?: () => Date;
  schedule?: (callback: () => void, intervalMs: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
  intervalMs?: number;
}>): NotificationScanner {
  const now = input.now ?? (() => new Date());
  const schedule = input.schedule ?? ((callback, intervalMs) => setInterval(callback, intervalMs));
  const cancel = input.cancel ?? ((handle) => clearInterval(handle));
  const intervalMs = input.intervalMs ?? NOTIFICATION_SCANNER_INTERVAL_MS;
  let timer: TimerHandle | null = null;
  let running = false;
  let runCount = 0;
  let failureCount = 0;
  let lastStartedAt: string | null = null;
  let lastCompletedAt: string | null = null;
  let lastFailedAt: string | null = null;
  let lastResultId: string | null = null;

  const status = (): NotificationScannerStatus => Object.freeze({
    running,
    runCount,
    failureCount,
    lastStartedAt,
    lastCompletedAt,
    lastFailedAt,
    lastResultId
  });

  const trigger = async (): Promise<void> => {
    if (running) return;
    running = true;
    runCount += 1;
    lastStartedAt = now().toISOString();
    try {
      const result = await input.scan();
      lastResultId = result.id;
      lastCompletedAt = now().toISOString();
      input.onSuccess(status());
    } catch (error) {
      failureCount += 1;
      lastFailedAt = now().toISOString();
      input.onFailure(error, status());
    } finally {
      running = false;
    }
  };

  return Object.freeze({
    start: () => {
      if (timer !== null) return;
      timer = schedule(() => { void trigger(); }, intervalMs);
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    },
    stop: () => {
      if (timer === null) return;
      cancel(timer);
      timer = null;
    },
    trigger,
    status
  });
}
