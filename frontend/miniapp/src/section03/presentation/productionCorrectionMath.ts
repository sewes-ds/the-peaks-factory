import type { Section03ProductionCorrectionMode } from '../program/context';

export type Section03ProductionCorrectionMathErrorCode =
  | 'INVALID_PRODUCTION_CORRECTION_DECIMAL'
  | 'INVALID_PRODUCTION_CORRECTION_MODE'
  | 'POSITIVE_CORRECTION_REQUIRED'
  | 'NEGATIVE_FINAL_QUANTITY'
  | 'ZERO_PRODUCTION_CORRECTION_DELTA';

export class Section03ProductionCorrectionMathError extends Error {
  readonly code: Section03ProductionCorrectionMathErrorCode;

  constructor(code: Section03ProductionCorrectionMathErrorCode) {
    super(code);
    this.name = 'Section03ProductionCorrectionMathError';
    this.code = code;
  }
}

export type Section03ProductionCorrectionMath = Readonly<{
  mode: Section03ProductionCorrectionMode;
  oldQuantity: string;
  correctionQuantity: string;
  signedCorrection: string;
  newQuantity: string;
  quantityDelta: string;
}>;

const canonicalDecimal = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

function fail(code: Section03ProductionCorrectionMathErrorCode): never {
  throw new Section03ProductionCorrectionMathError(code);
}

function parts(value: string): Readonly<{ integer: string; fraction: string }> {
  if (!canonicalDecimal.test(value)) return fail('INVALID_PRODUCTION_CORRECTION_DECIMAL');
  const [integer, fraction = ''] = value.split('.');
  return Object.freeze({ integer, fraction });
}

function scaled(left: string, right: string): Readonly<{ left: bigint; right: bigint; scale: number }> {
  const leftParts = parts(left);
  const rightParts = parts(right);
  const scale = leftParts.fraction.length > rightParts.fraction.length
    ? leftParts.fraction.length
    : rightParts.fraction.length;
  return Object.freeze({
    left: BigInt(`${leftParts.integer}${leftParts.fraction.padEnd(scale, '0')}`),
    right: BigInt(`${rightParts.integer}${rightParts.fraction.padEnd(scale, '0')}`),
    scale,
  });
}

function decimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const magnitude = (negative ? -value : value).toString();
  if (scale === 0) return `${negative ? '-' : ''}${magnitude}`;
  const padded = magnitude.padStart(scale + 1, '0');
  const integer = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  const unsigned = fraction.length === 0 ? integer : `${integer}.${fraction}`;
  return `${negative ? '-' : ''}${unsigned}`;
}

export function resolveSection03ProductionCorrectionMath(input: Readonly<{
  mode: string;
  freshBaseQuantity: string;
  correctionQuantity: string;
}>): Section03ProductionCorrectionMath {
  if (input.mode !== 'increase' && input.mode !== 'decrease' && input.mode !== 'final') {
    return fail('INVALID_PRODUCTION_CORRECTION_MODE');
  }
  const values = scaled(input.freshBaseQuantity, input.correctionQuantity);
  let newValue: bigint;
  let delta: bigint;
  if (input.mode === 'increase') {
    if (values.right === 0n) return fail('POSITIVE_CORRECTION_REQUIRED');
    newValue = values.left + values.right;
    delta = values.right;
  } else if (input.mode === 'decrease') {
    if (values.right === 0n) return fail('POSITIVE_CORRECTION_REQUIRED');
    newValue = values.left - values.right;
    if (newValue < 0n) return fail('NEGATIVE_FINAL_QUANTITY');
    delta = -values.right;
  } else {
    newValue = values.right;
    delta = values.right - values.left;
  }
  if (delta === 0n) return fail('ZERO_PRODUCTION_CORRECTION_DELTA');
  const quantityDelta = decimal(delta, values.scale);
  const signedCorrection = delta > 0n ? `+${quantityDelta}` : quantityDelta;
  return Object.freeze({
    mode: input.mode,
    oldQuantity: decimal(values.left, values.scale),
    correctionQuantity: decimal(values.right, values.scale),
    signedCorrection,
    newQuantity: decimal(newValue, values.scale),
    quantityDelta,
  });
}
