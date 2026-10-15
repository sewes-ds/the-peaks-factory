import { timingSafeEqual } from 'node:crypto';
import { ApiError } from '../db/errors.js';

export function assertInternalWorkerToken(actualToken: unknown, expectedToken: string): void {
  if (typeof actualToken !== 'string' || !isSafeTokenEqual(actualToken, expectedToken)) {
    throw new ApiError(401, 'unauthenticated', 'Internal worker token is invalid');
  }
}

function isSafeTokenEqual(actualToken: string, expectedToken: string): boolean {
  const actual = Buffer.from(actualToken);
  const expected = Buffer.from(expectedToken);

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
