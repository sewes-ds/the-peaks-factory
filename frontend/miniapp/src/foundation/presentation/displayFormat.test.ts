import { describe, expect, it } from 'vitest';
import {
  DisplayFormatError,
  formatDisplayDate,
  formatDisplayInteger,
  formatPersonName,
} from './displayFormat';

describe('shared display formatting', () => {
  it('renders calendar dates as dd.mm.yyyy', () => {
    expect(formatDisplayDate('2026-07-09')).toBe('09.07.2026');
    expect(formatDisplayDate('09.07.2026 14:30')).toBe('09.07.2026');
    expect(() => formatDisplayDate('2026-02-30')).toThrowError(DisplayFormatError);
  });

  it('rounds displayed quantities and amounts to whole numbers', () => {
    expect(formatDisplayInteger('12.49')).toBe('12');
    expect(formatDisplayInteger('12.5')).toBe('13');
    expect(formatDisplayInteger('-12.5')).toBe('-13');
    expect(formatDisplayInteger('00125.000')).toBe('125');
  });

  it('renders a stored surname-first name as surname and initials', () => {
    expect(formatPersonName('Садальский Петр Васильевич')).toBe('Садальский П.В.');
  });
});
