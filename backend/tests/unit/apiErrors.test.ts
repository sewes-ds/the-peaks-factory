import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError } from '../../src/db/errors.js';
import { toApiError, toApiErrorResponse } from '../../src/plugins/errors.js';

describe('API error boundary', () => {
  it('keeps explicit ApiError status, code, and message', () => {
    const error = new ApiError(403, 'forbidden', 'Forbidden');

    expect(toApiError(error)).toBe(error);
    expect(toApiErrorResponse(error)).toEqual({
      error: {
        code: 'forbidden',
        message: 'Forbidden'
      }
    });
  });

  it('maps Zod validation errors to safe bad request', () => {
    const result = z.object({ id: z.string() }).safeParse({});
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(toApiError(result.error)).toMatchObject({
        statusCode: 400,
        code: 'bad_request',
        message: 'Invalid request'
      });
    }
  });

  it('maps unexpected errors to safe internal error', () => {
    expect(toApiError(new Error('secret detail'))).toMatchObject({
      statusCode: 500,
      code: 'database_error',
      message: 'Internal server error'
    });
  });
});
