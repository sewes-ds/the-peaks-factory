import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual
} from 'node:crypto';

const PASSWORD_VERSION = 'v1';
const DEFAULT_SCRYPT_PARAMETERS: ScryptParameters = {
  cost: 32768,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
  maxMemoryBytes: 64 * 1024 * 1024
};

export type ScryptParameters = {
  cost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
  maxMemoryBytes: number;
};

export function normalizeAdminLogin(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalized) ? normalized : null;
}

export function validateNewAdminPassword(password: string, loginName?: string): string | null {
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (password.length < 12 || byteLength > 128) {
    return 'Пароль должен содержать от 12 до 128 байт';
  }

  if (loginName && password.toLocaleLowerCase('ru') === loginName.toLocaleLowerCase('ru')) {
    return 'Пароль не должен совпадать с логином';
  }

  const characterGroups = [
    /\p{Ll}/u.test(password),
    /\p{Lu}/u.test(password),
    /\p{N}/u.test(password),
    /[^\p{L}\p{N}\s]/u.test(password)
  ].filter(Boolean).length;

  if (characterGroups < 3) {
    return 'Используйте не менее трех групп: строчные, прописные, цифры и специальные знаки';
  }

  return null;
}

export async function hashAdminPassword(
  password: string,
  parameters: ScryptParameters = DEFAULT_SCRYPT_PARAMETERS
): Promise<string> {
  assertScryptParameters(parameters);
  const salt = randomBytes(16);
  const derivedKey = await deriveScryptKey(password, salt, parameters);

  return [
    'scrypt',
    PASSWORD_VERSION,
    parameters.cost.toString(),
    parameters.blockSize.toString(),
    parameters.parallelization.toString(),
    salt.toString('base64url'),
    derivedKey.toString('base64url')
  ].join('$');
}

export async function verifyAdminPassword(password: string, encodedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed) {
    return false;
  }

  const actual = await deriveScryptKey(password, parsed.salt, parsed.parameters);
  return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected);
}

export function createAdminOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAdminOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function constantTimeHashMatches(rawToken: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashAdminOpaqueToken(rawToken), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parsePasswordHash(encodedHash: string): {
  parameters: ScryptParameters;
  salt: Buffer;
  expected: Buffer;
} | null {
  const parts = encodedHash.split('$');
  if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== PASSWORD_VERSION) {
    return null;
  }

  const cost = Number(parts[2]);
  const blockSize = Number(parts[3]);
  const parallelization = Number(parts[4]);
  const salt = decodeBase64Url(parts[5]);
  const expected = decodeBase64Url(parts[6]);
  if (!salt || !expected || salt.length < 16 || expected.length !== 32) {
    return null;
  }

  const parameters: ScryptParameters = {
    cost,
    blockSize,
    parallelization,
    keyLength: expected.length,
    maxMemoryBytes: 64 * 1024 * 1024
  };

  try {
    assertScryptParameters(parameters);
    return { parameters, salt, expected };
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string | undefined): Buffer | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

function assertScryptParameters(parameters: ScryptParameters): void {
  if (
    !Number.isSafeInteger(parameters.cost)
    || parameters.cost < 1024
    || parameters.cost > 65536
    || (parameters.cost & (parameters.cost - 1)) !== 0
    || !Number.isSafeInteger(parameters.blockSize)
    || parameters.blockSize < 1
    || parameters.blockSize > 16
    || !Number.isSafeInteger(parameters.parallelization)
    || parameters.parallelization < 1
    || parameters.parallelization > 4
    || parameters.keyLength !== 32
    || parameters.maxMemoryBytes < 32 * 1024 * 1024
    || parameters.maxMemoryBytes > 128 * 1024 * 1024
  ) {
    throw new Error('Invalid scrypt parameters');
  }
}

function deriveScryptKey(
  password: string,
  salt: Buffer,
  parameters: ScryptParameters
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      parameters.keyLength,
      {
        N: parameters.cost,
        r: parameters.blockSize,
        p: parameters.parallelization,
        maxmem: parameters.maxMemoryBytes
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}
