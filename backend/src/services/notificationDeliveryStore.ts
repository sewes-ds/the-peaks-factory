import { assertReadOnlySql } from '../db/readQuery.js';
import type { DbExecutor } from '../db/pool.js';

export const NOTIFICATION_DELIVERY_BATCH_SIZE = 25;

export type PendingNotificationSend = Readonly<{
  notificationId: string;
  telegramUserId: string | null;
  recipientIsActive: boolean;
  title: string;
  messageText: string;
}>;

export type PendingNotificationHide = Readonly<{
  notificationId: string;
  telegramUserId: string | null;
  recipientIsActive: boolean;
  providerMessageId: string;
}>;

type PendingSendRow = {
  notification_id: string;
  telegram_user_id: string | null;
  recipient_is_active: boolean;
  title: string;
  message_text: string;
};

type PendingHideRow = {
  notification_id: string;
  telegram_user_id: string | null;
  recipient_is_active: boolean;
  provider_message_id: string;
};

const pendingSendSql = `
  select
    n.notification_id::text,
    e.telegram_user_id::text,
    (es.is_active and es.is_active_for_login) as recipient_is_active,
    n.title,
    n.message_text
  from app.notifications n
  join app.notification_statuses ns
    on ns.notification_status_id = n.notification_status_id
  join app.notification_channels nc
    on nc.notification_channel_id = n.notification_channel_id
  join app.employees e
    on e.employee_id = n.recipient_employee_id
  join app.employee_statuses es
    on es.employee_status_id = e.employee_status_id
  where ns.is_created = true
    and nc.is_telegram = true
    and nc.is_active = true
    and n.provider_message_id is null
  order by n.notification_id
  limit $1
`;

const pendingHideSql = `
  select
    n.notification_id::text,
    e.telegram_user_id::text,
    (es.is_active and es.is_active_for_login) as recipient_is_active,
    n.provider_message_id
  from app.notifications n
  join app.notification_statuses ns
    on ns.notification_status_id = n.notification_status_id
  join app.notification_channels nc
    on nc.notification_channel_id = n.notification_channel_id
  join app.employees e
    on e.employee_id = n.recipient_employee_id
  join app.employee_statuses es
    on es.employee_status_id = e.employee_status_id
  where ns.is_cancelled = true
    and nc.is_telegram = true
    and nc.is_active = true
    and n.provider_message_id is not null
    and n.hidden_from_chat_at is null
  order by n.notification_id
  limit $1
`;

export async function readPendingNotificationSends(
  db: DbExecutor,
  limit = NOTIFICATION_DELIVERY_BATCH_SIZE
): Promise<PendingNotificationSend[]> {
  assertDeliveryBatchSize(limit);
  assertReadOnlySql(pendingSendSql);
  const result = await db.query<PendingSendRow>(pendingSendSql, [limit]);
  return result.rows.map((row) => Object.freeze({
    notificationId: row.notification_id,
    telegramUserId: row.telegram_user_id,
    recipientIsActive: row.recipient_is_active,
    title: row.title,
    messageText: row.message_text
  }));
}

export async function readPendingNotificationHides(
  db: DbExecutor,
  limit = NOTIFICATION_DELIVERY_BATCH_SIZE
): Promise<PendingNotificationHide[]> {
  assertDeliveryBatchSize(limit);
  assertReadOnlySql(pendingHideSql);
  const result = await db.query<PendingHideRow>(pendingHideSql, [limit]);
  return result.rows.map((row) => Object.freeze({
    notificationId: row.notification_id,
    telegramUserId: row.telegram_user_id,
    recipientIsActive: row.recipient_is_active,
    providerMessageId: row.provider_message_id
  }));
}

function assertDeliveryBatchSize(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Notification delivery batch size is invalid');
  }
}
