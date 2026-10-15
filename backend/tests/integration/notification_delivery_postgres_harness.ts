import assert from 'node:assert/strict';
import pg from 'pg';
import {
  runNotificationDeliveryCycle,
  runOwnedNotificationDeliveryCycle
} from '../../src/services/notificationDelivery.js';
import { callNotificationRuntime } from '../../src/services/notifications.js';
import {
  TelegramNotificationProviderError,
  type TelegramNotificationProvider
} from '../../src/services/telegramNotificationProvider.js';

const adminUrl = process.env.NOTIFICATION_DELIVERY_ADMIN_DATABASE_URL;
const runtimeUrl = process.env.NOTIFICATION_DELIVERY_RUNTIME_DATABASE_URL;

if (!adminUrl || !runtimeUrl) {
  throw new Error('Notification delivery PostgreSQL harness requires admin and runtime database URLs');
}

const { Client, Pool } = pg;
const admin = new Client({ connectionString: adminUrl });
const runtime = new Pool({ connectionString: runtimeUrl, max: 2 });

await admin.connect();
try {
  const identity = await admin.query<{ current_database: string }>('select current_database()');
  const databaseName = identity.rows[0]?.current_database ?? '';
  assert.match(databaseName, /^the_peaks_notification_delivery_[a-z0-9_]+$/);

  const runtimeIdentity = await runtime.query<{ current_user: string }>('select current_user');
  assert.equal(runtimeIdentity.rows[0]?.current_user, 'app_runtime_role');

  const recipient = await admin.query<{ employee_id: string }>(`
    select e.employee_id::text
    from app.employees e
    join app.employee_statuses es on es.employee_status_id = e.employee_status_id
    where e.telegram_user_id is not null
      and es.is_active = true
      and es.is_active_for_login = true
    order by e.employee_id
    limit 1
  `);
  const employeeId = recipient.rows[0]?.employee_id;
  assert.ok(employeeId, 'Disposable restore must include one active Telegram-bound employee');

  await admin.query(`
    update app.notifications n
    set notification_status_id = cancelled.notification_status_id
    from app.notification_statuses current_status,
         app.notification_statuses cancelled
    where current_status.notification_status_id = n.notification_status_id
      and current_status.is_created = true
      and cancelled.is_cancelled = true
      and cancelled.is_active = true
  `);

  const fixture = await insertCreatedNotification(admin, employeeId, 'send');
  const sentProviderIds: string[] = [];
  const deletedProviderIds: string[] = [];
  const provider: TelegramNotificationProvider = {
    sendMessage: async ({ text }) => {
      assert.equal(text, 'Проверка доставки\n\nТочный текст проверки.');
      sentProviderIds.push('81001');
      return '81001';
    },
    deleteMessage: async ({ messageId }) => {
      deletedProviderIds.push(messageId);
    }
  };

  const sent = await runNotificationDeliveryCycle(runtime, provider);
  assert.equal(sent.sent, 1);
  assert.deepEqual(sentProviderIds, ['81001']);
  const sentState = await readNotificationState(admin, fixture);
  assert.equal(sentState.is_sent, true);
  assert.equal(sentState.provider_message_id, '81001');

  await callNotificationRuntime(runtime, 'hide_notification_from_chat', [fixture, false, true]);
  const hidden = await runNotificationDeliveryCycle(runtime, provider);
  assert.equal(hidden.hidden, 1);
  assert.deepEqual(deletedProviderIds, ['81001']);
  const hiddenState = await readNotificationState(admin, fixture);
  assert.equal(hiddenState.is_cancelled, true);
  assert.equal(hiddenState.hidden_from_chat_at !== null, true);

  const failedFixture = await insertCreatedNotification(admin, employeeId, 'failure');
  const failingProvider: TelegramNotificationProvider = {
    sendMessage: async () => {
      throw new TelegramNotificationProviderError('telegram_send_http_403');
    },
    deleteMessage: async () => undefined
  };
  const failed = await runNotificationDeliveryCycle(runtime, failingProvider);
  assert.equal(failed.sendFailed, 1);
  const failedState = await readNotificationState(admin, failedFixture);
  assert.equal(failedState.is_failed, true);
  assert.equal(failedState.delivery_error_text, 'telegram_send_http_403');

  await admin.query('select pg_advisory_lock($1, $2)', [19_780_621, 1]);
  try {
    const notOwner = await runOwnedNotificationDeliveryCycle(runtime, provider);
    assert.equal(notOwner.ownerAcquired, false);
  } finally {
    await admin.query('select pg_advisory_unlock($1, $2)', [19_780_621, 1]);
  }

  console.log('NOTIFICATION_DELIVERY_POSTGRES_HARNESS_PASS sent=1 hidden=1 failed=1 ownership=PASS');
} finally {
  await runtime.end();
  await admin.end();
}

async function insertCreatedNotification(
  client: pg.Client,
  employeeId: string,
  suffix: string
): Promise<string> {
  const result = await client.query<{ notification_id: string }>(`
    insert into app.notifications (
      recipient_employee_id,
      notification_channel_id,
      title,
      message_text,
      notification_status_id,
      deduplication_key
    )
    select
      $1::bigint,
      channel.notification_channel_id,
      'Проверка доставки',
      'Точный текст проверки.',
      status.notification_status_id,
      $2
    from app.notification_channels channel
    cross join app.notification_statuses status
    where channel.is_telegram = true
      and channel.is_active = true
      and status.is_created = true
      and status.is_active = true
    returning notification_id::text
  `, [employeeId, `notification_delivery_harness_${suffix}`]);
  const notificationId = result.rows[0]?.notification_id;
  assert.ok(notificationId);
  return notificationId;
}

async function readNotificationState(client: pg.Client, notificationId: string): Promise<{
  is_sent: boolean;
  is_failed: boolean;
  is_cancelled: boolean;
  provider_message_id: string | null;
  delivery_error_text: string | null;
  hidden_from_chat_at: string | null;
}> {
  const result = await client.query(`
    select
      status.is_sent,
      status.is_failed,
      status.is_cancelled,
      n.provider_message_id,
      n.delivery_error_text,
      n.hidden_from_chat_at::text
    from app.notifications n
    join app.notification_statuses status
      on status.notification_status_id = n.notification_status_id
    where n.notification_id = $1::bigint
  `, [notificationId]);
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}
