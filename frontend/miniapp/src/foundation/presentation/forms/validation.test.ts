import { describe, expect, it } from 'vitest';

import { definePresentationFormField, normalizePresentationNumeric, validatePresentationFormValue } from './validation';

const field = (kind: 'text' | 'multiline' | 'numeric' | 'date', extra: object = {}) => definePresentationFormField({
  id: `field-${kind}`,
  kind,
  label: 'Field',
  accessibilityLabel: 'Field input',
  required: true,
  ...(kind === 'numeric' ? { numericRule: 'positive' as const } : {}),
  ...extra,
});

describe('global form validation', () => {
  it('validates required text and multiline without silent coercion', () => {
    expect(validatePresentationFormValue(field('text'), '  ').code).toBe('REQUIRED');
    expect(validatePresentationFormValue(field('multiline'), '  reason  ').normalizedValue).toBe('reason');
  });

  it('accepts only deterministic finite decimal strings', () => {
    expect(validatePresentationFormValue(field('numeric'), '01').code).toBe('INVALID_DECIMAL');
    expect(validatePresentationFormValue(field('numeric'), '0').code).toBe('POSITIVE_REQUIRED');
    expect(validatePresentationFormValue(field('numeric', { numericRule: 'non-negative' }), '-1').code).toBe('NEGATIVE_FORBIDDEN');
    expect(validatePresentationFormValue(field('numeric', { numericRule: 'finite-decimal' }), '-12.3400').normalizedValue).toBe('-12.34');
    expect(validatePresentationFormValue(field('numeric'), '12.3400').normalizedValue).toBe('12.34');
    expect(normalizePresentationNumeric('8.000')).toBe('8');
    expect(normalizePresentationNumeric('-0.000')).toBe('0');
  });

  it('rejects unknown definition fields and invalid numeric rules', () => {
    expect(() => definePresentationFormField({
      ...field('text'),
      unexpected: true,
    } as unknown as Parameters<typeof definePresentationFormField>[0])).toThrowError('INVALID_FIELD_DEFINITION');
    expect(() => definePresentationFormField({
      ...field('numeric'),
      numericRule: 'integer',
    } as unknown as Parameters<typeof definePresentationFormField>[0])).toThrowError('INVALID_FIELD_DEFINITION');
  });

  it('validates exact calendar dates and length limits', () => {
    expect(validatePresentationFormValue(field('date'), '2026-02-29').code).toBe('INVALID_DATE');
    expect(validatePresentationFormValue(field('date'), '2026-02-28').valid).toBe(true);
    expect(validatePresentationFormValue(field('text', { minLength: 3 }), 'ab').code).toBe('MIN_LENGTH');
  });
});
