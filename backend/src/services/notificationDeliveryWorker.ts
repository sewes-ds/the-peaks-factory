import type { NotificationDeliveryCycleResult } from './notificationDelivery.js';

export const NOTIFICATION_DELIVERY_INTERVAL_MS = 5_000;

export type NotificationDeliveryWorkerStatus = Readonly<{
  running: boolean;
  blocked: boolean;
  runCount: number;
  failureCount: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastResult: NotificationDeliveryCycleResult | null;
}>;

type TimerHandle = ReturnType<typeof setInterval>;

export type NotificationDeliveryWorker = Readonly<{
  start: () => void;
  stop: () => Promise<void>;
  trigger: () => Promise<void>;
  status: () => NotificationDeliveryWorkerStatus;
}>;

export function createNotificationDeliveryWorker(input: Readonly<{
  deliver: () => Promise<NotificationDeliveryCycleResult>;
  onSuccess: (status: NotificationDeliveryWorkerStatus) => void;
  onFailure: (status: NotificationDeliveryWorkerStatus) => void;
  now?: () => Date;
  schedule?: (callback: () => void, intervalMs: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
  intervalMs?: number;
}>): NotificationDeliveryWorker {
  const now = input.now ?? (() => new Date());
  const schedule = input.schedule ?? ((callback, intervalMs) => setInterval(callback, intervalMs));
  const cancel = input.cancel ?? ((handle) => clearInterval(handle));
  const intervalMs = input.intervalMs ?? NOTIFICATION_DELIVERY_INTERVAL_MS;
  let timer: TimerHandle | null = null;
  let running = false;
  let blocked = false;
  let runCount = 0;
  let failureCount = 0;
  let lastStartedAt: string | null = null;
  let lastCompletedAt: string | null = null;
  let lastFailedAt: string | null = null;
  let lastResult: NotificationDeliveryCycleResult | null = null;
  let activeRun: Promise<void> | null = null;

  const status = (): NotificationDeliveryWorkerStatus => Object.freeze({
    running,
    blocked,
    runCount,
    failureCount,
    lastStartedAt,
    lastCompletedAt,
    lastFailedAt,
    lastResult
  });

  const trigger = async (): Promise<void> => {
    if (running || blocked) return;
    running = true;
    runCount += 1;
    lastStartedAt = now().toISOString();
    activeRun = (async () => {
      let failed = false;
      try {
        lastResult = await input.deliver();
        lastCompletedAt = now().toISOString();
        if (lastResult.ambiguousNotificationId !== null) {
          blocked = true;
          failed = true;
          failureCount += 1;
          lastFailedAt = lastCompletedAt;
        }
      } catch {
        failed = true;
        failureCount += 1;
        lastFailedAt = now().toISOString();
      } finally {
        running = false;
      }

      if (failed) {
        input.onFailure(status());
      } else {
        input.onSuccess(status());
      }
    })();

    try {
      await activeRun;
    } finally {
      activeRun = null;
    }
  };

  return Object.freeze({
    start: () => {
      if (timer !== null) return;
      timer = schedule(() => { void trigger(); }, intervalMs);
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();
      void trigger();
    },
    stop: async () => {
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      if (activeRun !== null) await activeRun;
    },
    trigger,
    status
  });
}
