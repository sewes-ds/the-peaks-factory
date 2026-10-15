import { createHmac, timingSafeEqual } from 'node:crypto';

export type SelfBindingTokenPayload = {
  telegram_contact_proof_id: string;
  employee_id: string;
  telegram_user_id: string;
  phone_e164: string;
  exp: number;
};

export type CreateSelfBindingTokenOptions = {
  telegramContactProofId: string;
  employeeId: string;
  telegramUserId: bigint;
  phoneE164: string;
  secret: string;
  ttlSeconds: number;
  now?: Date;
};

export type VerifySelfBindingTokenOptions = {
  token: string;
  telegramUserId: bigint;
  secret: string;
  now?: Date;
};

export type VerifySelfBindingTokenResult =
  | {
      status: 'VALID';
      payload: SelfBindingTokenPayload;
    }
  | {
      status: 'TOKEN_INVALID' | 'TOKEN_EXPIRED';
    };

export function createSelfBindingToken(options: CreateSelfBindingTokenOptions): string {
  const now = options.now ?? new Date();
  const payload: SelfBindingTokenPayload = {
    telegram_contact_proof_id: options.telegramContactProofId,
    employee_id: options.employeeId,
    telegram_user_id: options.telegramUserId.toString(),
    phone_e164: options.phoneE164,
    exp: Math.floor(now.getTime() / 1000) + options.ttlSeconds
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenBody(body, options.secret);

  return `${body}.${signature}`;
}

export function verifySelfBindingToken(options: VerifySelfBindingTokenOptions): VerifySelfBindingTokenResult {
  const [body, signature, extra] = options.token.split('.');
  if (!body || !signature || extra !== undefined) {
    return { status: 'TOKEN_INVALID' };
  }

  if (!safeEqual(signature, signTokenBody(body, options.secret))) {
    return { status: 'TOKEN_INVALID' };
  }

  let payload: SelfBindingTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SelfBindingTokenPayload;
  } catch {
    return { status: 'TOKEN_INVALID' };
  }

  if (!isSelfBindingTokenPayload(payload)) {
    return { status: 'TOKEN_INVALID' };
  }

  if (payload.telegram_user_id !== options.telegramUserId.toString()) {
    return { status: 'TOKEN_INVALID' };
  }

  const now = options.now ?? new Date();
  if (payload.exp < Math.floor(now.getTime() / 1000)) {
    return { status: 'TOKEN_EXPIRED' };
  }

  return {
    status: 'VALID',
    payload
  };
}

function isSelfBindingTokenPayload(value: unknown): value is SelfBindingTokenPayload {
  const candidate = value as Record<string, unknown>;

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof candidate.telegram_contact_proof_id === 'string' &&
    /^[1-9][0-9]*$/.test(candidate.telegram_contact_proof_id) &&
    typeof candidate.employee_id === 'string' &&
    /^[1-9][0-9]*$/.test(candidate.employee_id) &&
    typeof candidate.telegram_user_id === 'string' &&
    /^[1-9][0-9]*$/.test(candidate.telegram_user_id) &&
    typeof candidate.phone_e164 === 'string' &&
    /^\+[0-9]{7,15}$/.test(candidate.phone_e164) &&
    Number.isInteger(candidate.exp) &&
    Number(candidate.exp) > 0
  );
}

function signTokenBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function safeEqual(actualValue: string, expectedValue: string): boolean {
  const actual = Buffer.from(actualValue);
  const expected = Buffer.from(expectedValue);

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
