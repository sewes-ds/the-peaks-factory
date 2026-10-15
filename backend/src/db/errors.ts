export type ApiErrorCode =
  | 'unauthenticated'
  | 'bad_request'
  | 'conflict'
  | 'rate_limited'
  | 'additional_work_start_blocked'
  | 'additional_work_assignment_already_exists'
  | 'additional_work_target_not_available'
  | 'additional_work_type_not_available'
  | 'additional_work_assignment_forbidden'
  | 'additional_work_assignment_conflict'
  | 'password_change_required'
  | 'forbidden'
  | 'not_found'
  | 'database_error';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;

  public constructor(statusCode: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

type PgErrorLike = {
  code?: string;
  message?: string;
};

export function mapPostgresError(error: unknown): ApiError {
  const pgError = error as PgErrorLike;

  switch (pgError.code) {
    case '23503':
      return new ApiError(404, 'not_found', 'Referenced record was not found');
    case '23505':
      return new ApiError(409, 'conflict', 'Record already exists');
    case 'P0001':
      return new ApiError(409, 'conflict', 'Operation violates current business state');
    case '54000':
      return new ApiError(429, 'rate_limited', 'Too many requests');
    case '23514':
    case '22001':
    case '22P02':
    case '22023':
      return new ApiError(400, 'bad_request', 'Request violates database constraints');
    case '42501':
      return new ApiError(403, 'forbidden', 'Database permission denied');
    default:
      return new ApiError(500, 'database_error', 'Database operation failed');
  }
}
