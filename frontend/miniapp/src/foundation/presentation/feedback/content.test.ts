import { describe, expect, it } from 'vitest';

import { resolveControlPresentation } from '../controls';
import { resolveStatePresentation } from '../states';
import {
  CONTENT_FEEDBACK_ERROR_CODES,
  CONTENT_FEEDBACK_KINDS,
  ContentFeedbackError,
  resolveContentFeedback,
} from './content';

function code(input: unknown): string {
  try {
    resolveContentFeedback(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ContentFeedbackError);
    return (error as ContentFeedbackError).code;
  }
  throw new Error('Expected content feedback error.');
}

describe('content feedback presentation', () => {
  it('declares exact kinds and mappings in order', () => {
    expect(CONTENT_FEEDBACK_KINDS).toEqual([
      'loading',
      'empty',
      'success',
      'recoverable-error',
      'terminal-error',
    ]);
    expect(CONTENT_FEEDBACK_KINDS.map((kind) => {
      const value = resolveContentFeedback({ kind });
      return [
        value.kind,
        value.state.key,
        value.state.surface,
        value.ariaRole,
        value.ariaLive,
        value.ariaBusy,
        value.retryControl?.key ?? null,
        value.retryControl?.surface ?? null,
      ];
    })).toEqual([
      ['loading', 'state-info', 'message', 'status', 'polite', true, null, null],
      ['empty', 'state-neutral', 'message', 'status', 'polite', false, null, null],
      ['success', 'state-positive', 'message', 'status', 'polite', false, null, null],
      ['recoverable-error', 'state-warning', 'message', 'alert', 'assertive', false, 'action-neutral', 'action-button'],
      ['terminal-error', 'state-danger', 'message', 'alert', 'assertive', false, null, null],
    ]);
  });

  it('uses exact resolver-owned frozen state and retry objects', () => {
    for (const kind of CONTENT_FEEDBACK_KINDS) {
      const value = resolveContentFeedback({ kind });
      expect(value.state).toBe(resolveStatePresentation({
        key: value.state.key,
        surface: 'message',
      }));
      expect(Object.isFrozen(value)).toBe(true);
      expect(Object.isFrozen(value.state)).toBe(true);
      expect(Object.isFrozen(value.state.tokens)).toBe(true);
      if (value.retryControl !== null) {
        const expected = resolveControlPresentation({
          key: 'action-neutral',
          surface: 'action-button',
        });
        expect(value.retryControl.recipe).toBe(expected.recipe);
        expect(value.retryControl.tokens).toBe(expected.tokens);
        expect(Object.isFrozen(value.retryControl)).toBe(true);
      }
      expect(resolveContentFeedback({ kind })).toBe(value);
    }
  });

  it('contains no text, callback, error object or retry execution', () => {
    for (const kind of CONTENT_FEEDBACK_KINDS) {
      const value = resolveContentFeedback({ kind });
      expect(Object.keys(value).sort()).toEqual([
        'ariaBusy',
        'ariaLive',
        'ariaRole',
        'kind',
        'retryControl',
        'state',
      ]);
      expect('text' in value).toBe(false);
      expect('callback' in value).toBe(false);
      expect('error' in value).toBe(false);
      expect('retry' in value).toBe(false);
    }
  });

  it('rejects exact invalid boundaries with closed codes', () => {
    expect(code(null)).toBe('INVALID_CONTENT_FEEDBACK_REQUEST');
    expect(code([])).toBe('INVALID_CONTENT_FEEDBACK_REQUEST');
    expect(code({ kind: 'loading', text: 'x' })).toBe(
      'UNKNOWN_CONTENT_FEEDBACK_FIELD',
    );
    expect(code({ kind: 'warning' })).toBe('INVALID_CONTENT_FEEDBACK_KIND');
    expect(CONTENT_FEEDBACK_ERROR_CODES).toEqual([
      'INVALID_CONTENT_FEEDBACK_REQUEST',
      'UNKNOWN_CONTENT_FEEDBACK_FIELD',
      'INVALID_CONTENT_FEEDBACK_KIND',
    ]);
  });
});
