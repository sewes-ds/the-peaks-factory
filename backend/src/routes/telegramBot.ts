import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ActorContext } from '../auth/actorContext.js';
import { resolveActorEmployeeId } from '../auth/actorContext.js';
import { hashAdminOpaqueToken } from '../auth/adminPassword.js';
import { ApiError } from '../db/errors.js';
import type { AppEntrypointSection } from '../readModels/appEntrypoint.js';
import { getAppEntrypoint } from '../readModels/appEntrypoint.js';
import { recordTelegramContactProof } from '../services/telegramContactProof.js';
import { confirmAdminTelegramQrChallenge } from '../services/adminAuth.js';

const webhookParamsSchema = z.object({
  path_secret: z.string().min(1)
});

const telegramContactUpdateSchema = z.object({
  update_id: z.number().int().positive().safe(),
  message: z.object({
    message_id: z.number().int().positive().safe().nullable().optional(),
    chat: z.object({
      type: z.string()
    }),
    from: z.object({
      id: z.number().int().positive().safe(),
      username: z.string().min(1).optional()
    }),
    contact: z.object({
      phone_number: z.string().min(1),
      user_id: z.number().int().positive().safe()
    })
  })
});

const telegramDemoUpdateSchema = z.object({
  update_id: z.number().int().positive().safe(),
  message: z.object({
    chat: z.object({
      type: z.string()
    }),
    from: z.object({
      id: z.number().int().positive().safe(),
      username: z.string().min(1).optional()
    }),
    text: z.string()
  })
});

type TelegramWebhookSendMessage = {
  method: 'sendMessage';
  chat_id: number;
  text: string;
  reply_markup?: {
    inline_keyboard: [[{
      text: string;
      web_app: {
        url: string;
      };
    }]];
  };
};

export const telegramBotRoutes: FastifyPluginAsync = async (app) => {
  app.post('/telegram/bot/webhook/:path_secret', async (request) => {
    assertTelegramWebhookBoundary(
      request.params,
      request.headers['x-telegram-bot-api-secret-token'],
      app.config.TELEGRAM_BOT_WEBHOOK_PATH_SECRET,
      app.config.TELEGRAM_BOT_WEBHOOK_SECRET_TOKEN
    );

    if (!hasTelegramContactPayload(request.body)) {
      const demoUpdate = parseTelegramDemoUpdate(request.body);
      const adminQrToken = demoUpdate
        ? parseAdminTelegramQrStartToken(demoUpdate.message.text)
        : null;
      if (demoUpdate && adminQrToken) {
        if (demoUpdate.message.chat.type !== 'private') {
          return { ok: true, ignored: true };
        }
        const result = await confirmAdminTelegramQrChallenge(
          app.db,
          hashAdminOpaqueToken(adminQrToken),
          BigInt(demoUpdate.message.from.id)
        );
        return telegramAdminQrMessage(demoUpdate.message.from.id, result.status);
      }
      if (!demoUpdate || !isTelegramDemoCommand(demoUpdate.message.text)) {
        return { ok: true, ignored: true };
      }

      if (demoUpdate.message.chat.type !== 'private') {
        return { ok: true, ignored: true };
      }

      const telegramUserId = BigInt(demoUpdate.message.from.id);
      const employeeId = await resolveActorEmployeeId(app.db, telegramUserId);
      if (!employeeId) {
        return telegramDemoMessage(
          demoUpdate.message.from.id,
          'Telegram-учётная запись не привязана к активному сотруднику.'
        );
      }

      const actor: ActorContext = {
        employeeId,
        telegramUserId,
        telegramUsername: demoUpdate.message.from.username
      };
      const entrypoint = await getAppEntrypoint(app.db, actor);
      return telegramDemoEntrypointMessage(
        demoUpdate.message.from.id,
        entrypoint.section,
        app.config.PUBLIC_BASE_URL
      );
    }

    const update = parseTelegramContactUpdate(request.body);
    const normalizedPhone = normalizeTelegramPhoneNumber(update.message.contact.phone_number);

    if (update.message.chat.type !== 'private') {
      throw new ApiError(400, 'bad_request', 'Telegram contact update must come from private chat');
    }

    if (update.message.contact.user_id !== update.message.from.id) {
      throw new ApiError(400, 'bad_request', 'Telegram contact user mismatch');
    }

    await recordTelegramContactProof(app.db, {
      telegramUserId: BigInt(update.message.from.id),
      phoneE164: normalizedPhone,
      telegramUsername: update.message.from.username,
      botUpdateId: BigInt(update.update_id),
      botMessageId: update.message.message_id === null || update.message.message_id === undefined
        ? null
        : BigInt(update.message.message_id)
    });

    return { ok: true };
  });
};

export function isTelegramDemoCommand(text: string): boolean {
  return /^\/demo(?:@[A-Za-z0-9_]{5,32})?$/i.test(text.trim());
}

export function parseAdminTelegramQrStartToken(text: string): string | null {
  const match = text.trim().match(
    /^\/start(?:@[A-Za-z0-9_]{5,32})? admin_([A-Za-z0-9_-]{43})$/i
  );
  return match?.[1] ?? null;
}

function parseTelegramDemoUpdate(value: unknown): z.infer<typeof telegramDemoUpdateSchema> | null {
  const result = telegramDemoUpdateSchema.safeParse(value);
  return result.success ? result.data : null;
}

function telegramDemoEntrypointMessage(
  chatId: number,
  section: AppEntrypointSection,
  publicUrl: string
): TelegramWebhookSendMessage {
  if (section === 'section04') {
    return telegramDemoMessage(chatId, 'Кабинет директора не входит в текущую демонстрацию.');
  }

  if (section === 'section03') {
    return telegramDemoMessage(
      chatId,
      'Тестовый вход готов. Откройте кабинет начальника производства.',
      'Открыть Раздел 03',
      publicUrl
    );
  }

  return telegramDemoMessage(
    chatId,
    'Тестовый вход готов. Откройте кабинет оператора.',
    'Открыть Раздел 02',
    publicUrl
  );
}

function telegramAdminQrMessage(
  chatId: number,
  status: 'CONFIRMED' | 'EXPIRED' | 'ALREADY_USED' | 'NOT_BOUND' | 'FORBIDDEN' | 'UNAVAILABLE'
): TelegramWebhookSendMessage {
  switch (status) {
    case 'CONFIRMED':
      return telegramDemoMessage(
        chatId,
        'Вход подтвержден. Вернитесь в браузер — административная панель откроется автоматически.'
      );
    case 'NOT_BOUND':
      return telegramDemoMessage(
        chatId,
        'Telegram-учётная запись не привязана к активному сотруднику. Обратитесь к администратору системы.'
      );
    case 'FORBIDDEN':
      return telegramDemoMessage(
        chatId,
        'У вашей учётной записи нет доступа к административной панели.'
      );
    case 'EXPIRED':
      return telegramDemoMessage(
        chatId,
        'QR-код устарел. Обновите QR-код на странице административной панели и повторите вход.'
      );
    case 'ALREADY_USED':
      return telegramDemoMessage(chatId, 'Этот QR-код уже использован. Получите новый код на странице входа.');
    case 'UNAVAILABLE':
      return telegramDemoMessage(chatId, 'QR-код недействителен. Получите новый код на странице входа.');
  }
}

function telegramDemoMessage(
  chatId: number,
  text: string,
  buttonText?: string,
  buttonUrl?: string
): TelegramWebhookSendMessage {
  const response: TelegramWebhookSendMessage = {
    method: 'sendMessage',
    chat_id: chatId,
    text
  };

  if (buttonText && buttonUrl) {
    response.reply_markup = {
      inline_keyboard: [[{
        text: buttonText,
        web_app: { url: buttonUrl }
      }]]
    };
  }

  return response;
}

function assertTelegramWebhookBoundary(
  paramsValue: unknown,
  actualSecretToken: unknown,
  expectedPathSecret: string,
  expectedSecretToken: string
): void {
  const params = webhookParamsSchema.safeParse(paramsValue);
  if (!params.success || !safeEqual(params.data.path_secret, expectedPathSecret)) {
    throw new ApiError(401, 'unauthenticated', 'Telegram webhook path secret is invalid');
  }

  if (typeof actualSecretToken !== 'string' || !safeEqual(actualSecretToken, expectedSecretToken)) {
    throw new ApiError(401, 'unauthenticated', 'Telegram webhook token is invalid');
  }
}


function hasTelegramContactPayload(value: unknown): boolean {
  const root = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
  const message = root?.message;
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    return false;
  }

  const contact = (message as Record<string, unknown>).contact;
  return contact !== null && typeof contact === 'object' && !Array.isArray(contact);
}

function parseTelegramContactUpdate(value: unknown): z.infer<typeof telegramContactUpdateSchema> {
  const result = telegramContactUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid Telegram contact update');
  }

  return result.data;
}

function normalizeTelegramPhoneNumber(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const phoneE164 = compact.startsWith('+') ? compact : `+${compact}`;

  if (!/^\+[0-9]{7,15}$/.test(phoneE164)) {
    throw new ApiError(400, 'bad_request', 'Invalid Telegram contact phone');
  }

  return phoneE164;
}

function safeEqual(actualValue: string, expectedValue: string): boolean {
  const actual = Buffer.from(actualValue);
  const expected = Buffer.from(expectedValue);

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
