import { OPERATIONAL_TIME_ZONE } from '../../foundation/presentation/time/roles';
import type { Section03Period } from './context';

export const SECTION03_REPORT_TIME_ZONE = OPERATIONAL_TIME_ZONE;

export type Section03ReportDateErrorCode =
  | 'INVALID_REPORT_PERIOD'
  | 'INVALID_REPORT_INSTANT'
  | 'INVALID_REPORT_DATE'
  | 'INVALID_REPORT_RANGE';

export class Section03ReportDateError extends Error {
  readonly code: Section03ReportDateErrorCode;

  constructor(code: Section03ReportDateErrorCode) {
    super(code);
    this.name = 'Section03ReportDateError';
    this.code = code;
    Object.freeze(this);
  }
}

const periods = Object.freeze([
  'today', 'week', 'month', 'last_30_days',
] as const satisfies readonly Section03Period[]);

type CalendarDate = Readonly<{ year: number; month: number; day: number }>;

function leap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return leap(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseExactDate(value: unknown): CalendarDate {
  if (typeof value !== 'string') throw new Section03ReportDateError('INVALID_REPORT_DATE');
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (match === null) throw new Section03ReportDateError('INVALID_REPORT_DATE');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Section03ReportDateError('INVALID_REPORT_DATE');
  }
  return Object.freeze({ year, month, day });
}

function formatDate(value: CalendarDate): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function utcEpoch(value: CalendarDate): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(value.year, value.month - 1, value.day);
  return date.getTime();
}

function fromUtcEpoch(epochMs: number): CalendarDate {
  const date = new Date(epochMs);
  return Object.freeze({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function addDays(value: CalendarDate, days: number): CalendarDate {
  return fromUtcEpoch(utcEpoch(value) + days * 86_400_000);
}

function operationalDate(nowEpochMs: number): CalendarDate {
  if (!Number.isFinite(nowEpochMs) || !Number.isInteger(nowEpochMs)) {
    throw new Section03ReportDateError('INVALID_REPORT_INSTANT');
  }
  const instant = new Date(nowEpochMs);
  if (Number.isNaN(instant.getTime())) throw new Section03ReportDateError('INVALID_REPORT_INSTANT');
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: SECTION03_REPORT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant);
  } catch {
    throw new Section03ReportDateError('INVALID_REPORT_INSTANT');
  }
  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (value === undefined) throw new Section03ReportDateError('INVALID_REPORT_INSTANT');
    return Number(value);
  };
  return Object.freeze({ year: part('year'), month: part('month'), day: part('day') });
}

export function resolveSection03PredefinedReportRange(
  period: Section03Period,
  nowEpochMs: number,
): Readonly<{ period: Section03Period; from_date: string; to_date: string }> {
  if (!periods.includes(period)) throw new Section03ReportDateError('INVALID_REPORT_PERIOD');
  const today = operationalDate(nowEpochMs);
  let from = today;
  if (period === 'week') {
    const weekday = new Date(utcEpoch(today)).getUTCDay();
    from = addDays(today, -(weekday === 0 ? 6 : weekday - 1));
  } else if (period === 'month') {
    from = Object.freeze({ year: today.year, month: today.month, day: 1 });
  } else if (period === 'last_30_days') {
    from = addDays(today, -29);
  }
  return Object.freeze({ period, from_date: formatDate(from), to_date: formatDate(today) });
}

export function resolveSection03ExplicitReportRange(
  fromDate: string,
  toDate: string,
): Readonly<{ from_date: string; to_date: string }> {
  const from = parseExactDate(fromDate);
  const to = parseExactDate(toDate);
  if (utcEpoch(from) > utcEpoch(to)) throw new Section03ReportDateError('INVALID_REPORT_RANGE');
  return Object.freeze({ from_date: formatDate(from), to_date: formatDate(to) });
}
