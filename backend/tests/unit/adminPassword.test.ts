import { describe, expect, it } from 'vitest';
import {
  constantTimeHashMatches,
  createAdminOpaqueToken,
  hashAdminOpaqueToken,
  hashAdminPassword,
  normalizeAdminLogin,
  validateNewAdminPassword,
  verifyAdminPassword
} from '../../src/auth/adminPassword.js';

const TEST_SCRYPT = {
  cost: 1024,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
  maxMemoryBytes: 32 * 1024 * 1024
};

describe('admin password authentication primitives', () => {
  it('normalizes only bounded ASCII login identifiers', () => {
    expect(normalizeAdminLogin(' Director.One ')).toBe('director.one');
    expect(normalizeAdminLogin('ab')).toBeNull();
    expect(normalizeAdminLogin('директор')).toBeNull();
    expect(normalizeAdminLogin('bad login')).toBeNull();
  });

  it('hashes and verifies passwords with versioned scrypt metadata', async () => {
    const passwordHash = await hashAdminPassword('Secure-Manager-2026!', TEST_SCRYPT);

    expect(passwordHash).toMatch(/^scrypt\$v1\$1024\$8\$1\$/);
    await expect(verifyAdminPassword('Secure-Manager-2026!', passwordHash)).resolves.toBe(true);
    await expect(verifyAdminPassword('wrong-password', passwordHash)).resolves.toBe(false);
    await expect(verifyAdminPassword('Secure-Manager-2026!', 'malformed')).resolves.toBe(false);
  });

  it('applies the technical password policy without storing plaintext', () => {
    expect(validateNewAdminPassword('short')).toContain('12');
    expect(validateNewAdminPassword('all-lowercase-password')).toContain('трех групп');
    expect(validateNewAdminPassword('Strong-Password-2026!')).toBeNull();
  });

  it('creates independent opaque tokens and compares only SHA-256 hashes', () => {
    const token = createAdminOpaqueToken();
    const anotherToken = createAdminOpaqueToken();
    const tokenHash = hashAdminOpaqueToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toBe(anotherToken);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(constantTimeHashMatches(token, tokenHash)).toBe(true);
    expect(constantTimeHashMatches(anotherToken, tokenHash)).toBe(false);
  });
});
