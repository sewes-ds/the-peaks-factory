import { describe, expect, it } from 'vitest';
import {
  createSelfBindingToken,
  verifySelfBindingToken
} from '../../src/auth/selfBindingToken.js';

const secret = '12345678901234567890123456789012';
const now = new Date('2026-06-03T12:00:00.000Z');

describe('self-binding token', () => {
  it('creates and verifies a short-lived token', () => {
    const token = createSelfBindingToken({
      telegramContactProofId: '1001',
      employeeId: '42',
      telegramUserId: 777n,
      phoneE164: '+998901234567',
      secret,
      ttlSeconds: 600,
      now
    });

    expect(
      verifySelfBindingToken({
        token,
        telegramUserId: 777n,
        secret,
        now: new Date('2026-06-03T12:05:00.000Z')
      })
    ).toMatchObject({
      status: 'VALID',
        payload: {
          telegram_contact_proof_id: '1001',
          employee_id: '42',
        telegram_user_id: '777',
        phone_e164: '+998901234567'
      }
    });
  });

  it('rejects tampered, mismatched and expired tokens', () => {
    const token = createSelfBindingToken({
      telegramContactProofId: '1001',
      employeeId: '42',
      telegramUserId: 777n,
      phoneE164: '+998901234567',
      secret,
      ttlSeconds: 60,
      now
    });

    expect(
      verifySelfBindingToken({
        token: `${token}x`,
        telegramUserId: 777n,
        secret,
        now
      })
    ).toEqual({ status: 'TOKEN_INVALID' });

    expect(
      verifySelfBindingToken({
        token,
        telegramUserId: 778n,
        secret,
        now
      })
    ).toEqual({ status: 'TOKEN_INVALID' });

    expect(
      verifySelfBindingToken({
        token,
        telegramUserId: 777n,
        secret,
        now: new Date('2026-06-03T12:02:00.000Z')
      })
    ).toEqual({ status: 'TOKEN_EXPIRED' });
  });
});
