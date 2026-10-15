import { ApiError } from '../db/errors.js';

type NumericConversionOptions = {
  nullable?: boolean;
  integerSafe?: boolean;
};

export function toDtoNumber(value: string | number | null | undefined, fieldName: string): number;
export function toDtoNumber(
  value: string | number | null | undefined,
  fieldName: string,
  options: NumericConversionOptions & { nullable?: false }
): number;
export function toDtoNumber(
  value: string | number | null | undefined,
  fieldName: string,
  options: NumericConversionOptions & { nullable: true }
): number | null;
export function toDtoNumber(
  value: string | number | null | undefined,
  fieldName: string,
  options: NumericConversionOptions = {}
): number | null {
  if (value === null || value === undefined) {
    if (options.nullable) {
      return null;
    }

    throw new ApiError(500, 'database_error', `${fieldName} is required`);
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new ApiError(500, 'database_error', `${fieldName} is not a finite number`);
  }

  if (options.integerSafe && (!Number.isInteger(parsed) || !Number.isSafeInteger(parsed))) {
    throw new ApiError(500, 'database_error', `${fieldName} is not an integer-safe UZS amount`);
  }

  if (!Number.isSafeInteger(Math.trunc(parsed))) {
    throw new ApiError(500, 'database_error', `${fieldName} exceeds safe DTO number range`);
  }

  return parsed;
}

export function toDtoUzsAmount(value: string | number | null | undefined, fieldName: string): number {
  return toDtoNumber(value, fieldName, { integerSafe: true });
}
