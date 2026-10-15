import { describe, expect, it } from 'vitest';
import {
  resolvePresentationGraphContent,
} from '../../foundation/presentation';
import {
  Section03TimeBindingError,
  normalizeSection03ZonedTimestamp,
  parseSection03DurationMinutes,
  section03DowntimeDurationContent,
  section03DowntimeStartContent,
} from './timeBindings';

describe('Section03 time bindings', () => {
  it('passes RFC3339 and normalizes explicit PostgreSQL offsets', () => {
    expect(normalizeSection03ZonedTimestamp(
      '2026-07-31T10:20:30Z',
    )).toBe('2026-07-31T10:20:30Z');
    expect(normalizeSection03ZonedTimestamp(
      '2026-07-31 10:20:30+00',
    )).toBe('2026-07-31T10:20:30+00:00');
    expect(normalizeSection03ZonedTimestamp(
      '2026-07-31 10:20:30+05',
    )).toBe('2026-07-31T10:20:30+05:00');
    expect(normalizeSection03ZonedTimestamp(
      '2026-07-31 10:20:30.125+05:00',
    )).toBe('2026-07-31T10:20:30.125+05:00');
    expect(normalizeSection03ZonedTimestamp(
      '2026-07-31 10:20:30-05',
    )).toBe('2026-07-31T10:20:30-05:00');
  });

  it('rejects no-zone and invalid timestamp values', () => {
    for (const value of [
      '2026-07-31 10:20:30',
      '2026-07-31T10:20:30',
      '2026-07-31T10:20Z',
      '2026-02-30T10:20:30Z',
      '2026-07-31T10:20:30+99:00',
      '2026-07-31',
      null,
    ]) {
      expect(() => normalizeSection03ZonedTimestamp(value))
        .toThrow(Section03TimeBindingError);
    }
  });

  it('parses only closed duration forms', () => {
    expect([
      '5 мин',
      '0 ч 5 мин',
      '1 ч 0 мин',
      '1 ч 20 мин',
      '24 ч 1 мин',
    ].map(parseSection03DurationMinutes)).toEqual([5, 5, 60, 80, 1441]);
    for (const value of [
      '',
      null,
      '1:20',
      '80 minutes',
      '1 ч 60 мин',
      '-1 мин',
      '1.5 мин',
      '9007199254740992 мин',
    ]) {
      expect(() => parseSection03DurationMinutes(value))
        .toThrow(Section03TimeBindingError);
    }
  });

  it('creates global time requests without raw backend display strings', () => {
    const critical = section03DowntimeStartContent({
      downtime_started_at: '2026-07-31 10:20:30+05',
      downtime_type: 'critical',
    });
    const operational = section03DowntimeStartContent({
      downtime_started_at: '2026-07-31T10:20:30+05:00',
      downtime_type: 'operational',
    });
    const duration = section03DowntimeDurationContent({
      downtime_duration: '1 ч 20 мин',
    });
    expect(critical).toMatchObject({
      kind: 'time',
      request: { role: 'date-time-multiline' },
    });
    expect(operational).toMatchObject({
      kind: 'time',
      request: { role: 'time-only' },
    });
    expect(duration).toEqual({
      kind: 'time',
      request: { role: 'elapsed-duration', totalMinutes: 80 },
    });
    expect(resolvePresentationGraphContent(critical).lines)
      .toEqual(['31.07.2026', '10:20']);
    expect(resolvePresentationGraphContent(operational).text).toBe('10:20');
    expect(resolvePresentationGraphContent(duration).text).toBe('1 ч 20 мин');
    expect(JSON.stringify(duration)).not.toContain('1 ч 20 мин');
  });
});
