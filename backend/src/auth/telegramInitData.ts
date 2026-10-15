import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().optional()
});

export type TelegramInitDataValidation = {
  telegramUserId: bigint;
  telegramUsername?: string;
  authDate: Date;
};

export type ValidateTelegramInitDataOptions = {
  botToken: string;
  maxAgeSeconds: number;
  now?: Date;
};

export function validateTelegramInitData(
  initData: string,
  options: ValidateTelegramInitDataOptions
): TelegramInitDataValidation {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new Error('Telegram init data hash is missing');
  }

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(options.botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!isSafeHashEqual(hash, expectedHash)) {
    throw new Error('Telegram init data hash is invalid');
  }

  const authDateSeconds = Number(params.get('auth_date'));
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    throw new Error('Telegram init data auth_date is invalid');
  }

  const now = options.now ?? new Date();
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDateSeconds;
  if (ageSeconds < 0 || ageSeconds > options.maxAgeSeconds) {
    throw new Error('Telegram init data is expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new Error('Telegram init data user is missing');
  }

  const user = parseTelegramUser(userRaw);

  return {
    telegramUserId: BigInt(user.id),
    telegramUsername: user.username,
    authDate: new Date(authDateSeconds * 1000)
  };
}

function isSafeHashEqual(actualHash: string, expectedHash: string): boolean {
  const actual = Buffer.from(actualHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function parseTelegramUser(userRaw: string): z.infer<typeof telegramUserSchema> {
  try {
    return telegramUserSchema.parse(JSON.parse(userRaw));
  } catch {
    throw new Error('Telegram init data user is invalid');
  }
}
