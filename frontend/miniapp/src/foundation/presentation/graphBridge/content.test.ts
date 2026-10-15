import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_GRAPH_CONTENT_ERROR_CODES,
  PresentationGraphContentError,
  isResolvedPresentationGraphContentOwned,
  resolvePresentationGraphContent,
} from './content';

function code(input: unknown): string {
  try {
    resolvePresentationGraphContent(input);
  } catch (error) {
    expect(error).toBeInstanceOf(PresentationGraphContentError);
    return (error as PresentationGraphContentError).code;
  }
  throw new Error('Expected content error.');
}

describe('presentation Graph content', () => {
  it('preserves exact text in one frozen line', () => {
    const input = { kind: 'text', text: ' Exact text ' } as const;
    const output = resolvePresentationGraphContent(input);
    expect(output).toEqual({
      sourceKind: 'text',
      text: ' Exact text ',
      lines: [' Exact text '],
    });
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.lines)).toBe(true);
    expect(isResolvedPresentationGraphContentOwned(output)).toBe(true);
    expect(isResolvedPresentationGraphContentOwned({
      ...output,
    })).toBe(false);
    expect(input).toEqual({ kind: 'text', text: ' Exact text ' });
  });

  it('resolves all accepted time roles to exact lines', () => {
    expect(resolvePresentationGraphContent({
      kind: 'time',
      request: {
        role: 'time-only',
        timestamp: '2026-07-29T09:25Z',
      },
    })).toMatchObject({ text: '14:25', lines: ['14:25'] });
    expect(resolvePresentationGraphContent({
      kind: 'time',
      request: {
        role: 'date-time-multiline',
        timestamp: '2026-07-29T20:30Z',
      },
    })).toMatchObject({
      text: '30.07.2026\n01:30',
      lines: ['30.07.2026', '01:30'],
    });
    expect(resolvePresentationGraphContent({
      kind: 'time',
      request: { role: 'elapsed-duration', totalMinutes: 80 },
    })).toMatchObject({ text: '1 ч 20 мин', lines: ['1 ч 20 мин'] });
  });

  it('rejects blank, raw and extensible content with closed errors', () => {
    expect(code(null)).toBe('INVALID_GRAPH_CONTENT');
    expect(code({ kind: 'html', text: '<b>x</b>' })).toBe(
      'INVALID_GRAPH_CONTENT_KIND',
    );
    expect(code({ kind: 'text', text: ' ' })).toBe('INVALID_GRAPH_TEXT');
    expect(code({ kind: 'text', text: 'x', html: true })).toBe(
      'UNKNOWN_GRAPH_CONTENT_FIELD',
    );
    expect(code({
      kind: 'time',
      request: {
        role: 'time-only',
        timestamp: new Date(),
      },
    })).toBe('INVALID_GRAPH_TIME_REQUEST');
    expect(code({
      kind: 'time',
      request: { role: 'time-only', timestamp: 1 },
    })).toBe('INVALID_GRAPH_TIME_REQUEST');
    expect(code({
      kind: 'time',
      request: {
        role: 'time-only',
        timestamp: '2026-07-29T09:25',
      },
    })).toBe('INVALID_GRAPH_TIME_REQUEST');
    expect(code({
      kind: 'time',
      request: {
        role: 'time-only',
        timestamp: '2026-07-29T09:25Z',
      },
      formatter: () => 'x',
    })).toBe('UNKNOWN_GRAPH_CONTENT_FIELD');
  });

  it('has exact frozen errors and preserves formatter error', () => {
    expect(PRESENTATION_GRAPH_CONTENT_ERROR_CODES).toEqual([
      'INVALID_GRAPH_CONTENT',
      'UNKNOWN_GRAPH_CONTENT_FIELD',
      'INVALID_GRAPH_CONTENT_KIND',
      'INVALID_GRAPH_TEXT',
      'INVALID_GRAPH_TIME_REQUEST',
    ]);
    try {
      resolvePresentationGraphContent({
        kind: 'time',
        request: { role: 'time-only', timestamp: 'bad' },
      });
    } catch (error) {
      expect((error as PresentationGraphContentError).originalError)
        .toBeInstanceOf(Error);
    }
  });
});
