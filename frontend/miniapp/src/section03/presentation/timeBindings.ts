import {
  formatTimePresentation,
  type PresentationGraphContentInput,
} from '../../foundation/presentation';
import type { ManagerMachine } from '../contracts';

export const SECTION03_TIME_BINDING_ERROR_CODES = Object.freeze([
  'INVALID_SECTION03_TIMESTAMP',
  'SECTION03_TIMESTAMP_TIME_ZONE_REQUIRED',
  'INVALID_SECTION03_DURATION',
  'SECTION03_DOWNTIME_TYPE_REQUIRED',
  'SECTION03_TIME_FORMATTER_REJECTED',
] as const);

export type Section03TimeBindingErrorCode =
  typeof SECTION03_TIME_BINDING_ERROR_CODES[number];

export class Section03TimeBindingError extends Error {
  readonly code: Section03TimeBindingErrorCode;
  readonly originalError: unknown;

  constructor(
    code: Section03TimeBindingErrorCode,
    originalError?: unknown,
  ) {
    super(code);
    this.name = 'Section03TimeBindingError';
    this.code = code;
    this.originalError = originalError;
    Object.freeze(this);
  }
}

const rfc3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const postgres =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-])(\d{2})(?::(\d{2}))?$/;

function formatterProof(timestamp: string): void {
  try {
    formatTimePresentation({ role: 'time-only', timestamp });
  } catch (originalError) {
    throw new Section03TimeBindingError(
      'SECTION03_TIME_FORMATTER_REJECTED',
      originalError,
    );
  }
}

export function normalizeSection03ZonedTimestamp(
  value: unknown,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Section03TimeBindingError('INVALID_SECTION03_TIMESTAMP');
  }
  const input = value.trim();
  if (rfc3339.test(input)) {
    formatterProof(input);
    return input;
  }
  const match = postgres.exec(input);
  if (match !== null) {
    const [, date, time, sign, offsetHour, offsetMinute = '00'] = match;
    const normalized =
      `${date}T${time}${sign}${offsetHour}:${offsetMinute}`;
    formatterProof(normalized);
    return normalized;
  }
  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(input) &&
    !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(input)
  ) {
    throw new Section03TimeBindingError(
      'SECTION03_TIMESTAMP_TIME_ZONE_REQUIRED',
    );
  }
  throw new Section03TimeBindingError('INVALID_SECTION03_TIMESTAMP');
}

function safeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Section03TimeBindingError('INVALID_SECTION03_DURATION');
  }
  return parsed;
}

export function parseSection03DurationMinutes(value: unknown): number {
  if (typeof value !== 'string') {
    throw new Section03TimeBindingError('INVALID_SECTION03_DURATION');
  }
  const input = value.trim();
  const minutesOnly = /^(\d+) мин$/.exec(input);
  if (minutesOnly !== null) {
    return safeInteger(minutesOnly[1]!);
  }
  const hoursAndMinutes = /^(\d+) ч (\d+) мин$/.exec(input);
  if (hoursAndMinutes === null) {
    throw new Section03TimeBindingError('INVALID_SECTION03_DURATION');
  }
  const hours = safeInteger(hoursAndMinutes[1]!);
  const minutes = safeInteger(hoursAndMinutes[2]!);
  if (minutes > 59) {
    throw new Section03TimeBindingError('INVALID_SECTION03_DURATION');
  }
  const total = hours * 60 + minutes;
  if (!Number.isSafeInteger(total)) {
    throw new Section03TimeBindingError('INVALID_SECTION03_DURATION');
  }
  return total;
}

export function section03DowntimeStartContent(
  machine: Pick<ManagerMachine, 'downtime_started_at' | 'downtime_type'>,
): PresentationGraphContentInput | null {
  if (machine.downtime_started_at === null) {
    return null;
  }
  if (machine.downtime_type === null) {
    throw new Section03TimeBindingError(
      'SECTION03_DOWNTIME_TYPE_REQUIRED',
    );
  }
  const timestamp = normalizeSection03ZonedTimestamp(
    machine.downtime_started_at,
  );
  return Object.freeze({
    kind: 'time',
    request: Object.freeze({
      role: machine.downtime_type === 'critical'
        ? 'date-time-multiline'
        : 'time-only',
      timestamp,
    }),
  });
}

export function section03DowntimeDurationContent(
  machine: Pick<ManagerMachine, 'downtime_duration'>,
): PresentationGraphContentInput | null {
  if (machine.downtime_duration === null) {
    return null;
  }
  return Object.freeze({
    kind: 'time',
    request: Object.freeze({
      role: 'elapsed-duration',
      totalMinutes: parseSection03DurationMinutes(
        machine.downtime_duration,
      ),
    }),
  });
}
