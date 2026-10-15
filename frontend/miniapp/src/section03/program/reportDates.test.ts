import { describe, expect, it } from 'vitest';
import { OPERATIONAL_TIME_ZONE } from '../../foundation/presentation/time/roles';
import {
  SECTION03_REPORT_TIME_ZONE,
  Section03ReportDateError,
  resolveSection03ExplicitReportRange,
  resolveSection03PredefinedReportRange,
} from './reportDates';

const instant = (value: string) => Date.parse(value);

describe('Section 03 report dates', () => {
  it('uses the accepted operational timezone and resolves today at the UTC/Tashkent boundary', () => {
    expect(SECTION03_REPORT_TIME_ZONE).toBe(OPERATIONAL_TIME_ZONE);
    expect(SECTION03_REPORT_TIME_ZONE).toBe('Asia/Tashkent');
    expect(resolveSection03PredefinedReportRange('today', instant('2026-08-03T20:30:00Z'))).toEqual({
      period: 'today', from_date: '2026-08-04', to_date: '2026-08-04',
    });
  });

  it('uses ISO Monday for Monday and Sunday weeks', () => {
    expect(resolveSection03PredefinedReportRange('week', instant('2026-08-03T08:00:00Z'))).toEqual({
      period: 'week', from_date: '2026-08-03', to_date: '2026-08-03',
    });
    expect(resolveSection03PredefinedReportRange('week', instant('2026-08-09T08:00:00Z'))).toEqual({
      period: 'week', from_date: '2026-08-03', to_date: '2026-08-09',
    });
  });

  it('handles month/year boundaries, leap day and inclusive last 30 days', () => {
    expect(resolveSection03PredefinedReportRange('month', instant('2027-01-01T08:00:00Z'))).toEqual({
      period: 'month', from_date: '2027-01-01', to_date: '2027-01-01',
    });
    expect(resolveSection03PredefinedReportRange('today', instant('2028-02-29T08:00:00Z')).to_date).toBe('2028-02-29');
    expect(resolveSection03PredefinedReportRange('last_30_days', instant('2026-03-01T08:00:00Z'))).toEqual({
      period: 'last_30_days', from_date: '2026-01-31', to_date: '2026-03-01',
    });
  });

  it('rejects malformed, impossible and reversed explicit ranges without normalization', () => {
    expect(resolveSection03ExplicitReportRange('2028-02-29', '2028-02-29')).toEqual({ from_date: '2028-02-29', to_date: '2028-02-29' });
    for (const value of ['2026-8-01', ' 2026-08-01', '2026-02-29', '0000-01-01']) {
      expect(() => resolveSection03ExplicitReportRange(value, '2026-08-04')).toThrowError(expect.objectContaining({ code: 'INVALID_REPORT_DATE' }));
    }
    expect(() => resolveSection03ExplicitReportRange('2026-08-05', '2026-08-04')).toThrowError(expect.objectContaining({ code: 'INVALID_REPORT_RANGE' }));
  });

  it('has closed errors and frozen outputs', () => {
    const predefined = resolveSection03PredefinedReportRange('today', instant('2026-08-04T08:00:00Z'));
    const explicit = resolveSection03ExplicitReportRange('2026-08-01', '2026-08-04');
    expect(Object.isFrozen(predefined)).toBe(true);
    expect(Object.isFrozen(explicit)).toBe(true);
    expect(() => resolveSection03PredefinedReportRange('invalid' as 'today', instant('2026-08-04T08:00:00Z'))).toThrowError(expect.objectContaining({ code: 'INVALID_REPORT_PERIOD' }));
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, 9e20]) {
      expect(() => resolveSection03PredefinedReportRange('today', value)).toThrow(Section03ReportDateError);
    }
  });
});
