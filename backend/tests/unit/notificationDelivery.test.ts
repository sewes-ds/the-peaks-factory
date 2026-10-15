import { describe, expect, it, vi } from 'vitest';
import type { DbExecutor } from '../../src/db/pool.js';
import {
  runNotificationDeliveryCycle,
  type NotificationDeliveryCycleResult
} from '../../src/services/notificationDelivery.js';
import {
  readPendingNotificationHides,
  readPendingNotificationSends
} from '../../src/services/notificationDeliveryStore.js';
import {
  createNotificationDeliveryWorker,
  NOTIFICATION_DELIVERY_INTERVAL_MS
} from '../../src/services/notificationDeliveryWorker.js';
import {
  createTelegramNotificationProvider,
  formatTelegramNotification,
  TelegramNotificationProviderError,
  TELEGRAM_NOTIFICATION_TEXT_LIMIT,
  type TelegramNotificationProvider
} from '../../src/services/telegramNotificationProvider.js';

type QueryCall = { sql: string; params: readonly unknown[] };

type SendRow = {
  notification_id: string;
  telegram_user_id: string | null;
  recipient_is_active: boolean;
  title: string;
  message_text: string;
};

type HideRow = {
  notification_id: string;
  telegram_user_id: string | null;
  recipient_is_active: boolean;
  provider_message_id: string;
};

function createDeliveryDb(input: Readonly<{
  sends?: SendRow[];
  hides?: HideRow[];
  failMarkSent?: boolean;
  failMarkHidden?: boolean;
}> = {}): { db: DbExecutor; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const db = {
    query: async (sql: string, params: readonly unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('ns.is_cancelled = true')) return { rows: input.hides ?? [] };
      if (sql.includes('ns.is_created = true')) return { rows: input.sends ?? [] };
      if (input.failMarkSent && sql.includes('app.mark_notification_sent')) {
        throw new Error('database unavailable');
      }
      if (input.failMarkHidden && sql.includes('app.hide_notification_from_chat')) {
        throw new Error('database unavailable');
      }
      return { rows: [{ result: params[0] ?? '1' }] };
    }
  } as unknown as DbExecutor;
  return { db, calls };
}

function provider(overrides: Partial<TelegramNotificationProvider> = {}): TelegramNotificationProvider {
  return {
    sendMessage: vi.fn(async () => '701'),
    deleteMessage: vi.fn(async () => undefined),
    ...overrides
  };
}

describe('notification delivery read surface', () => {
  it('reads only created Telegram rows in stable bounded order', async () => {
    const { db, calls } = createDeliveryDb({
      sends: [{
        notification_id: '11', telegram_user_id: '42', recipient_is_active: true,
        title: 'Заголовок', message_text: 'Текст'
      }]
    });
    await expect(readPendingNotificationSends(db)).resolves.toEqual([{
      notificationId: '11', telegramUserId: '42', recipientIsActive: true,
      title: 'Заголовок', messageText: 'Текст'
    }]);
    expect(calls[0]?.sql).toMatch(/^\s*select\b/i);
    expect(calls[0]?.sql).toContain('ns.is_created = true');
    expect(calls[0]?.sql).toContain('order by n.notification_id');
    expect(calls[0]?.params).toEqual([25]);
  });

  it('reads only cancelled Telegram rows that still need provider hiding', async () => {
    const { db, calls } = createDeliveryDb({
      hides: [{
        notification_id: '12', telegram_user_id: '43', recipient_is_active: true,
        provider_message_id: '702'
      }]
    });
    await expect(readPendingNotificationHides(db)).resolves.toEqual([{
      notificationId: '12', telegramUserId: '43', recipientIsActive: true,
      providerMessageId: '702'
    }]);
    expect(calls[0]?.sql).toContain('ns.is_cancelled = true');
    expect(calls[0]?.sql).toContain('n.hidden_from_chat_at is null');
  });
});

describe('notification delivery lifecycle', () => {
  it('sends stored copy unchanged as plain text and marks only sent', async () => {
    const { db, calls } = createDeliveryDb({
      sends: [{
        notification_id: '21', telegram_user_id: '1001', recipient_is_active: true,
        title: 'Допработа согласована', message_text: 'Допработа: Упаковка согласована.'
      }]
    });
    const sendMessage = vi.fn(async () => '9001');
    const result = await runNotificationDeliveryCycle(db, provider({ sendMessage }));

    expect(sendMessage).toHaveBeenCalledWith({
      chatId: '1001',
      text: 'Допработа согласована\n\nДопработа: Упаковка согласована.'
    });
    expect(calls.some(({ sql, params }) =>
      sql === 'select app.mark_notification_sent($1, $2) as result'
      && params[0] === '21'
      && params[1] === '9001')).toBe(true);
    expect(calls.some(({ sql }) => sql.includes('mark_notification_delivered'))).toBe(false);
    expect(result).toMatchObject({ sent: 1, sendFailed: 0, ambiguousNotificationId: null, ambiguousOperation: null });
  });

  it('records unavailable recipients as failed without calling Telegram', async () => {
    const { db, calls } = createDeliveryDb({
      sends: [{
        notification_id: '22', telegram_user_id: null, recipient_is_active: true,
        title: 'Заголовок', message_text: 'Текст'
      }]
    });
    const sendMessage = vi.fn(async () => 'unused');
    const result = await runNotificationDeliveryCycle(db, provider({ sendMessage }));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(calls.some(({ sql, params }) =>
      sql === 'select app.mark_notification_failed($1, $2) as result'
      && params[0] === '22'
      && params[1] === 'notification_recipient_unavailable')).toBe(true);
    expect(result).toMatchObject({ sent: 0, sendFailed: 1 });
  });

  it('records a sanitized Telegram provider failure', async () => {
    const { db, calls } = createDeliveryDb({
      sends: [{
        notification_id: '23', telegram_user_id: '1003', recipient_is_active: true,
        title: 'Заголовок', message_text: 'Текст'
      }]
    });
    const sendMessage = vi.fn(async () => {
      throw new TelegramNotificationProviderError('telegram_send_http_403');
    });
    const result = await runNotificationDeliveryCycle(db, provider({ sendMessage }));

    expect(calls.some(({ params }) => params[1] === 'telegram_send_http_403')).toBe(true);
    expect(result).toMatchObject({ sent: 0, sendFailed: 1 });
  });

  it('deletes a cancelled Telegram task and records confirmed hiding', async () => {
    const { db, calls } = createDeliveryDb({
      hides: [{
        notification_id: '24', telegram_user_id: '1004', recipient_is_active: true,
        provider_message_id: '8004'
      }]
    });
    const deleteMessage = vi.fn(async () => undefined);
    const result = await runNotificationDeliveryCycle(db, provider({ deleteMessage }));

    expect(deleteMessage).toHaveBeenCalledWith({ chatId: '1004', messageId: '8004' });
    expect(calls.some(({ sql, params }) =>
      sql === 'select app.hide_notification_from_chat($1, $2, $3) as result'
      && params[0] === '24'
      && params[1] === true
      && params[2] === true)).toBe(true);
    expect(result).toMatchObject({ hidden: 1, hideFailed: 0 });
  });

  it('reports an ambiguous send and stops the batch if provider success cannot be recorded', async () => {
    const { db } = createDeliveryDb({
      failMarkSent: true,
      sends: [
        { notification_id: '25', telegram_user_id: '1005', recipient_is_active: true, title: 'A', message_text: 'B' },
        { notification_id: '26', telegram_user_id: '1006', recipient_is_active: true, title: 'C', message_text: 'D' }
      ]
    });
    const sendMessage = vi.fn(async () => '9005');
    const result = await runNotificationDeliveryCycle(db, provider({ sendMessage }));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ sent: 0, sendFailed: 1, ambiguousNotificationId: '25', ambiguousOperation: 'send' });
  });

  it('reports an ambiguous hide and does not start sends if provider deletion cannot be recorded', async () => {
    const { db } = createDeliveryDb({
      failMarkHidden: true,
      hides: [{
        notification_id: '29', telegram_user_id: '1009', recipient_is_active: true,
        provider_message_id: '8009'
      }],
      sends: [{
        notification_id: '30', telegram_user_id: '1010', recipient_is_active: true,
        title: 'A', message_text: 'B'
      }]
    });
    const deleteMessage = vi.fn(async () => undefined);
    const sendMessage = vi.fn(async () => '9010');
    const result = await runNotificationDeliveryCycle(db, provider({ deleteMessage, sendMessage }));

    expect(deleteMessage).toHaveBeenCalledOnce();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      hidden: 0, hideFailed: 1, sendCandidates: 0,
      ambiguousNotificationId: '29', ambiguousOperation: 'hide'
    });
  });

  it('attempts at most one message per Telegram chat in one cycle', async () => {
    const { db, calls } = createDeliveryDb({
      sends: [
        { notification_id: '27', telegram_user_id: '1007', recipient_is_active: true, title: 'A', message_text: 'B' },
        { notification_id: '28', telegram_user_id: '1007', recipient_is_active: true, title: 'C', message_text: 'D' }
      ]
    });
    const sendMessage = vi.fn(async () => '9007');
    const result = await runNotificationDeliveryCycle(db, provider({ sendMessage }));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(calls.some(({ params }) => params[0] === '27' && params[1] === '9007')).toBe(true);
    expect(calls.some(({ params }) => params[0] === '28')).toBe(false);
    expect(result).toMatchObject({ sendCandidates: 2, sent: 1, sendFailed: 0 });
  });
});

describe('Telegram notification provider', () => {
  it('uses Bot API JSON without parse mode and returns the provider message id', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ chat_id: '77', text: 'Заголовок\n\nТекст' });
      expect(JSON.parse(String(init?.body))).not.toHaveProperty('parse_mode');
      return new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as unknown as typeof fetch;
    const telegram = createTelegramNotificationProvider({ botToken: '123:test-token', fetchImpl });
    await expect(telegram.sendMessage({ chatId: '77', text: 'Заголовок\n\nТекст' })).resolves.toBe('123');
  });

  it('sends deleteMessage with a numeric provider message id', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ chat_id: '77', message_id: 123 });
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as unknown as typeof fetch;
    const telegram = createTelegramNotificationProvider({ botToken: '123:test-token', fetchImpl });
    await expect(telegram.deleteMessage({ chatId: '77', messageId: '123' })).resolves.toBeUndefined();
  });

  it('never exposes the bot token through a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('request failed for https://api.telegram.org/bot123:secret/sendMessage');
    }) as unknown as typeof fetch;
    const telegram = createTelegramNotificationProvider({ botToken: '123:secret', fetchImpl });
    await expect(telegram.sendMessage({ chatId: '77', text: 'Текст' }))
      .rejects.toThrow('telegram_send_network_error');
    await expect(telegram.sendMessage({ chatId: '77', text: 'Текст' }))
      .rejects.not.toThrow('123:secret');
  });

  it('rejects an oversized composed message before provider delivery', () => {
    expect(() => formatTelegramNotification('A', 'Б'.repeat(TELEGRAM_NOTIFICATION_TEXT_LIMIT)))
      .toThrow('telegram_message_too_long');
  });
});

describe('notification delivery worker', () => {
  it('runs immediately, schedules every five seconds, suppresses overlap and blocks ambiguous outcomes', async () => {
    let scheduled: (() => void) | null = null;
    let finish!: (value: NotificationDeliveryCycleResult) => void;
    const pending = new Promise<NotificationDeliveryCycleResult>((resolve) => { finish = resolve; });
    const deliver = vi.fn(() => pending);
    const onFailure = vi.fn();
    const worker = createNotificationDeliveryWorker({
      deliver,
      onSuccess: vi.fn(),
      onFailure,
      schedule: (callback, intervalMs) => {
        expect(intervalMs).toBe(NOTIFICATION_DELIVERY_INTERVAL_MS);
        scheduled = callback;
        return 1 as unknown as ReturnType<typeof setInterval>;
      },
      cancel: vi.fn()
    });

    worker.start();
    expect(scheduled).not.toBeNull();
    await worker.trigger();
    expect(deliver).toHaveBeenCalledTimes(1);
    finish({
      ownerAcquired: true, sendCandidates: 1, sent: 0, sendFailed: 1,
      hideCandidates: 0, hidden: 0, hideFailed: 0,
      ambiguousNotificationId: '31', ambiguousOperation: 'send'
    });
    await vi.waitFor(() => expect(worker.status()).toMatchObject({ running: false, blocked: true, failureCount: 1 }));
    await worker.trigger();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledOnce();
    await worker.stop();
  });
});
