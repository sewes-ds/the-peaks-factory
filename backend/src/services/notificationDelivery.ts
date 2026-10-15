import type { PoolClient } from 'pg';
import type { DbExecutor, DbPool } from '../db/pool.js';
import { callNotificationRuntime } from './notifications.js';
import {
  readPendingNotificationHides,
  readPendingNotificationSends
} from './notificationDeliveryStore.js';
import {
  formatTelegramNotification,
  TelegramNotificationProviderError,
  type TelegramNotificationProvider
} from './telegramNotificationProvider.js';

const NOTIFICATION_DELIVERY_LOCK_NAMESPACE = 19_780_621;
const NOTIFICATION_DELIVERY_LOCK_KEY = 1;

export type NotificationDeliveryCycleResult = Readonly<{
  ownerAcquired: boolean;
  sendCandidates: number;
  sent: number;
  sendFailed: number;
  hideCandidates: number;
  hidden: number;
  hideFailed: number;
  ambiguousNotificationId: string | null;
  ambiguousOperation: 'send' | 'hide' | null;
}>;

export async function runOwnedNotificationDeliveryCycle(
  pool: DbPool,
  provider: TelegramNotificationProvider
): Promise<NotificationDeliveryCycleResult> {
  const client = await pool.connect();
  let ownerAcquired = false;
  try {
    ownerAcquired = await tryAcquireDeliveryOwnership(client);
    if (!ownerAcquired) return emptyCycle(false);
    return await runNotificationDeliveryCycle(client, provider);
  } finally {
    try {
      if (ownerAcquired) await releaseDeliveryOwnership(client);
    } finally {
      client.release();
    }
  }
}

export async function runNotificationDeliveryCycle(
  db: DbExecutor,
  provider: TelegramNotificationProvider
): Promise<NotificationDeliveryCycleResult> {
  const hides = await readPendingNotificationHides(db);
  let hidden = 0;
  let hideFailed = 0;
  let ambiguousNotificationId: string | null = null;
  let ambiguousOperation: 'send' | 'hide' | null = null;
  const hideChatsAttempted = new Set<string>();

  for (const candidate of hides) {
    let providerAccepted = false;
    try {
      assertRecipientAvailable(candidate.recipientIsActive, candidate.telegramUserId);
      if (hideChatsAttempted.has(candidate.telegramUserId)) continue;
      hideChatsAttempted.add(candidate.telegramUserId);
      await provider.deleteMessage({
        chatId: candidate.telegramUserId,
        messageId: candidate.providerMessageId
      });
      providerAccepted = true;
      await callNotificationRuntime(db, 'hide_notification_from_chat', [
        candidate.notificationId,
        true,
        true
      ]);
      hidden += 1;
    } catch (error) {
      hideFailed += 1;
      if (providerAccepted) {
        ambiguousNotificationId = candidate.notificationId;
        ambiguousOperation = 'hide';
        break;
      }
      await recordFailure(db, candidate.notificationId, failureCode(error, 'notification_hide_failed'));
    }
  }

  const sends = ambiguousNotificationId === null ? await readPendingNotificationSends(db) : [];
  let sent = 0;
  let sendFailed = 0;
  const sendChatsAttempted = new Set<string>();

  for (const candidate of sends) {
    let providerAccepted = false;
    try {
      assertRecipientAvailable(candidate.recipientIsActive, candidate.telegramUserId);
      if (sendChatsAttempted.has(candidate.telegramUserId)) continue;
      sendChatsAttempted.add(candidate.telegramUserId);
      const providerMessageId = await provider.sendMessage({
        chatId: candidate.telegramUserId,
        text: formatTelegramNotification(candidate.title, candidate.messageText)
      });
      providerAccepted = true;
      await callNotificationRuntime(db, 'mark_notification_sent', [
        candidate.notificationId,
        providerMessageId
      ]);
      sent += 1;
    } catch (error) {
      sendFailed += 1;
      if (providerAccepted) {
        ambiguousNotificationId = candidate.notificationId;
        ambiguousOperation = 'send';
        break;
      }
      await recordFailure(db, candidate.notificationId, failureCode(error, 'notification_send_failed'));
    }
  }

  return Object.freeze({
    ownerAcquired: true,
    sendCandidates: sends.length,
    sent,
    sendFailed,
    hideCandidates: hides.length,
    hidden,
    hideFailed,
    ambiguousNotificationId,
    ambiguousOperation
  });
}

async function tryAcquireDeliveryOwnership(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ acquired: boolean }>(
    'select pg_try_advisory_lock($1, $2) as acquired',
    [NOTIFICATION_DELIVERY_LOCK_NAMESPACE, NOTIFICATION_DELIVERY_LOCK_KEY]
  );
  return result.rows[0]?.acquired === true;
}

async function releaseDeliveryOwnership(client: PoolClient): Promise<void> {
  await client.query('select pg_advisory_unlock($1, $2)', [
    NOTIFICATION_DELIVERY_LOCK_NAMESPACE,
    NOTIFICATION_DELIVERY_LOCK_KEY
  ]);
}

async function recordFailure(db: DbExecutor, notificationId: string, safeCode: string): Promise<void> {
  await callNotificationRuntime(db, 'mark_notification_failed', [notificationId, safeCode]);
}

function assertRecipientAvailable(
  active: boolean,
  telegramUserId: string | null
): asserts telegramUserId is string {
  if (!active || telegramUserId === null) {
    throw new TelegramNotificationProviderError('notification_recipient_unavailable');
  }
}

function failureCode(error: unknown, fallback: string): string {
  return error instanceof TelegramNotificationProviderError ? error.safeCode : fallback;
}

function emptyCycle(ownerAcquired: boolean): NotificationDeliveryCycleResult {
  return Object.freeze({
    ownerAcquired,
    sendCandidates: 0,
    sent: 0,
    sendFailed: 0,
    hideCandidates: 0,
    hidden: 0,
    hideFailed: 0,
    ambiguousNotificationId: null,
    ambiguousOperation: null
  });
}
