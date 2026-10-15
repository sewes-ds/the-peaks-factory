export const TELEGRAM_NOTIFICATION_TEXT_LIMIT = 4096;
const TELEGRAM_PROVIDER_TIMEOUT_MS = 10_000;

export interface TelegramNotificationProvider {
  sendMessage(input: Readonly<{ chatId: string; text: string }>): Promise<string>;
  deleteMessage(input: Readonly<{ chatId: string; messageId: string }>): Promise<void>;
}

export class TelegramNotificationProviderError extends Error {
  constructor(public readonly safeCode: string) {
    super(safeCode);
    this.name = 'TelegramNotificationProviderError';
  }
}

type FetchLike = typeof fetch;

export function createTelegramNotificationProvider(input: Readonly<{
  botToken: string;
  fetchImpl?: FetchLike;
}>): TelegramNotificationProvider {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const baseUrl = `https://api.telegram.org/bot${input.botToken}`;

  return Object.freeze({
    sendMessage: async ({ chatId, text }: Readonly<{ chatId: string; text: string }>) => {
      const payload = await callTelegramApi(fetchImpl, `${baseUrl}/sendMessage`, {
        chat_id: chatId,
        text
      }, 'send');
      const messageId = readTelegramMessageId(payload);
      if (messageId === null) {
        throw new TelegramNotificationProviderError('telegram_send_invalid_response');
      }
      return messageId;
    },
    deleteMessage: async ({ chatId, messageId }: Readonly<{ chatId: string; messageId: string }>) => {
      const parsedMessageId = parseTelegramMessageId(messageId);
      const payload = await callTelegramApi(fetchImpl, `${baseUrl}/deleteMessage`, {
        chat_id: chatId,
        message_id: parsedMessageId
      }, 'delete');
      if (payload.ok !== true || payload.result !== true) {
        throw new TelegramNotificationProviderError('telegram_delete_invalid_response');
      }
    }
  });
}

export function formatTelegramNotification(title: string, messageText: string): string {
  const text = `${title}\n\n${messageText}`;
  if (text.length > TELEGRAM_NOTIFICATION_TEXT_LIMIT) {
    throw new TelegramNotificationProviderError('telegram_message_too_long');
  }
  return text;
}

async function callTelegramApi(
  fetchImpl: FetchLike,
  url: string,
  body: Readonly<Record<string, string | number>>,
  operation: 'send' | 'delete'
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEGRAM_PROVIDER_TIMEOUT_MS)
    });
  } catch {
    throw new TelegramNotificationProviderError(`telegram_${operation}_network_error`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TelegramNotificationProviderError(`telegram_${operation}_invalid_json`);
  }

  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    throw new TelegramNotificationProviderError(`telegram_${operation}_http_${response.status}`);
  }

  return payload;
}

function readTelegramMessageId(payload: Record<string, unknown>): string | null {
  if (!isRecord(payload.result)) return null;
  const messageId = payload.result.message_id;
  return typeof messageId === 'number' && Number.isSafeInteger(messageId) && messageId > 0
    ? messageId.toString()
    : null;
}

function parseTelegramMessageId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new TelegramNotificationProviderError('telegram_delete_invalid_message_id');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new TelegramNotificationProviderError('telegram_delete_invalid_message_id');
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
