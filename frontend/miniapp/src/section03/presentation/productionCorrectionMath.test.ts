import { describe, expect, it } from 'vitest';
import {
  resolveSection03ProductionCorrectionMath,
  Section03ProductionCorrectionMathError,
} from './productionCorrectionMath';

describe('production correction exact decimal math', () => {
  it.each([
    ['increase', '10', '2.500', '10', '2.5', '+2.5', '12.5', '2.5'],
    ['decrease', '12.750', '2.25', '12.75', '2.25', '-2.25', '10.5', '-2.25'],
    ['final', '10', '0', '10', '0', '-10', '0', '-10'],
    ['final', '0.125', '2.000', '0.125', '2', '+1.875', '2', '1.875'],
    ['increase', '999999999999999999999.1', '1.0000', '999999999999999999999.1', '1', '+1', '1000000000000000000000.1', '1'],
  ] as const)(
    '%s resolves %s with %s exactly',
    (mode, freshBaseQuantity, correctionQuantity, oldQuantity, normalizedCorrection, signedCorrection, newQuantity, quantityDelta) => {
      expect(resolveSection03ProductionCorrectionMath({ mode, freshBaseQuantity, correctionQuantity })).toEqual({
        mode, oldQuantity, correctionQuantity: normalizedCorrection, signedCorrection, newQuantity, quantityDelta,
      });
    },
  );

  it.each([
    ['INVALID_PRODUCTION_CORRECTION_DECIMAL', { mode: 'increase', freshBaseQuantity: '01', correctionQuantity: '1' }],
    ['INVALID_PRODUCTION_CORRECTION_DECIMAL', { mode: 'increase', freshBaseQuantity: '1', correctionQuantity: '1e2' }],
    ['INVALID_PRODUCTION_CORRECTION_MODE', { mode: 'replace', freshBaseQuantity: '1', correctionQuantity: '2' }],
    ['POSITIVE_CORRECTION_REQUIRED', { mode: 'increase', freshBaseQuantity: '1', correctionQuantity: '0' }],
    ['POSITIVE_CORRECTION_REQUIRED', { mode: 'decrease', freshBaseQuantity: '1', correctionQuantity: '0.00' }],
    ['NEGATIVE_FINAL_QUANTITY', { mode: 'decrease', freshBaseQuantity: '1', correctionQuantity: '1.1' }],
    ['ZERO_PRODUCTION_CORRECTION_DELTA', { mode: 'final', freshBaseQuantity: '1.0', correctionQuantity: '1.00' }],
  ] as const)('fails closed with %s', (code, input) => {
    expect(() => resolveSection03ProductionCorrectionMath(input)).toThrowError(
      expect.objectContaining<Partial<Section03ProductionCorrectionMathError>>({ code }),
    );
  });

  it('does not mutate inputs and deeply freezes the scalar result', () => {
    const input = Object.freeze({ mode: 'increase', freshBaseQuantity: '1.20', correctionQuantity: '0.30' });
    const result = resolveSection03ProductionCorrectionMath(input);
    expect(input).toEqual({ mode: 'increase', freshBaseQuantity: '1.20', correctionQuantity: '0.30' });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
