import { describe, expect, it } from 'vitest';
import {
  formatSection03SalaryMonth,
  Section03SalaryMonthFormatError,
} from './salaryMonth';

describe('Section 03 deterministic Russian salary month contract', () => {
  it('formats every month without locale, timezone or host dependencies', () => {
    const expected = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
    ];
    for (const [index, name] of expected.entries()) {
      const month = String(index + 1).padStart(2, '0');
      expect(formatSection03SalaryMonth(`2026-${month}`)).toBe(`${name} 2026`);
      expect(formatSection03SalaryMonth(`2026-${month}-01`)).toBe(`${name} 2026`);
    }
    expect(formatSection03SalaryMonth('2025-12-01')).toBe('Декабрь 2025');
    expect(formatSection03SalaryMonth('2026-01-01')).toBe('Январь 2026');
  });

  it.each([
    '', '2026-00', '2026-13', '2026-7', '26-07', '2026-07-02',
    '2026-07T00:00:00Z', 'Июль 2026', '0000-01', ' 2026-07 ',
  ])('fails closed for non-canonical month %j', (value) => {
    expect(() => formatSection03SalaryMonth(value)).toThrow(Section03SalaryMonthFormatError);
  });
});
