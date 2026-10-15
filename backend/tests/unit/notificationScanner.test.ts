import { describe, expect, it, vi } from 'vitest';
import {
  createNotificationScanner,
  NOTIFICATION_SCANNER_INTERVAL_MS
} from '../../src/services/notificationScanner.js';

describe('application-owned notification downtime scanner', () => {
  it('C4-DOWNTIME-SCHEDULER-01 schedules once per minute and suppresses overlap', async () => {
    let scheduled: (() => void) | null = null;
    let finish!: (value: { id: string }) => void;
    const pending = new Promise<{ id: string }>((resolve) => { finish = resolve; });
    const scan = vi.fn(() => pending);
    const cancel = vi.fn();
    const scanner = createNotificationScanner({
      scan,
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
      schedule: (callback, intervalMs) => {
        expect(intervalMs).toBe(NOTIFICATION_SCANNER_INTERVAL_MS);
        scheduled = callback;
        return 1 as unknown as ReturnType<typeof setInterval>;
      },
      cancel
    });

    scanner.start();
    scanner.start();
    expect(scheduled).not.toBeNull();
    const first = scanner.trigger();
    await scanner.trigger();
    expect(scan).toHaveBeenCalledTimes(1);
    finish({ id: '1' });
    await first;
    expect(scanner.status()).toMatchObject({ running: false, runCount: 1, failureCount: 0, lastResultId: '1' });
    scanner.stop();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('records a failed scan without rejecting the scheduler loop', async () => {
    const onFailure = vi.fn();
    const scanner = createNotificationScanner({
      scan: async () => { throw new Error('scan failed'); },
      onSuccess: vi.fn(),
      onFailure
    });
    await expect(scanner.trigger()).resolves.toBeUndefined();
    expect(scanner.status()).toMatchObject({ running: false, runCount: 1, failureCount: 1 });
    expect(onFailure).toHaveBeenCalledOnce();
  });
});
