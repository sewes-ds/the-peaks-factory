import { describe, expect, it } from 'vitest';
import { formatSection02SalaryMonth, Section02SalaryMonthFormatError } from './salaryMonth';

describe('Section 02 salary month presentation', () => {
  it('renders ISO and already formatted values as Month Year', () => {
    expect(formatSection02SalaryMonth('2026-07')).toBe('Июль 2026');
    expect(formatSection02SalaryMonth('2026-07-01')).toBe('Июль 2026');
    expect(formatSection02SalaryMonth('Июль 2026')).toBe('Июль 2026');
  });

  it('fails closed for an invalid month', () => {
    expect(() => formatSection02SalaryMonth('2026-13')).toThrow(Section02SalaryMonthFormatError);
  });
});
