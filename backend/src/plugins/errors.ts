import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from '../db/errors.js';

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export const errorPlugin: FastifyPluginAsync = fp(async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    const apiError = toApiError(error);

    return reply.status(apiError.statusCode).send(toApiErrorResponse(apiError));
  });
});

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ApiError(400, 'bad_request', 'Invalid request');
  }

  return new ApiError(500, 'database_error', 'Internal server error');
}

export function toApiErrorResponse(error: ApiError): ApiErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message
    }
  };
}
