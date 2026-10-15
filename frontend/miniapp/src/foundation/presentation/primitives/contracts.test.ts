import { describe, expect, it } from 'vitest';

import { resolveControlPresentation } from '../controls';
import {
  resolveContentFeedback,
  resolveControlFeedback,
} from '../feedback';
import { resolveStatePresentation } from '../states';
import {
  PRESENTATION_PRIMITIVE_ERROR_CODES,
  PresentationPrimitiveError,
  assertCardLines,
  assertControlSurface,
  assertStateSurface,
  interactiveHandler,
  retryHandler,
} from './contracts';

function errorCode(callback: () => void): string {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(PresentationPrimitiveError);
    expect(Object.isFrozen(error)).toBe(true);
    return (error as PresentationPrimitiveError).code;
  }
  throw new Error('Expected primitive contract error.');
}

describe('presentation primitive contracts', () => {
  it('validates exact control and state surfaces', () => {
    const action = resolveControlPresentation({
      key: 'action-neutral',
      surface: 'action-button',
    });
    const card = resolveStatePresentation({
      key: 'state-info',
      surface: 'card',
    });

    expect(() => assertControlSurface(action, 'action-button')).not.toThrow();
    expect(() => assertStateSurface(card, 'card')).not.toThrow();
    expect(errorCode(() =>
      assertControlSurface(action, 'list-button'),
    )).toBe('CONTROL_SURFACE_MISMATCH');
    expect(errorCode(() =>
      assertStateSurface(card, 'message'),
    )).toBe('STATE_SURFACE_MISMATCH');
    expect(errorCode(() =>
      assertControlSurface({}, 'action-button'),
    )).toBe('INVALID_PRIMITIVE_PRESENTATION');
  });

  it('enforces enabled, disabled, pending and inert interaction', () => {
    const handler = () => undefined;
    const enabled = resolveControlFeedback({
      availability: 'enabled',
      preserveToneWhenDisabled: false,
    });
    const disabled = resolveControlFeedback({
      availability: 'disabled',
      preserveToneWhenDisabled: false,
    });
    const pending = resolveControlFeedback({
      availability: 'pending',
      preserveToneWhenDisabled: false,
    });
    const inert = resolveControlFeedback({
      availability: 'inert',
      preserveToneWhenDisabled: true,
    });

    expect(interactiveHandler(enabled, handler)).toBe(handler);
    expect(errorCode(() => interactiveHandler(enabled, undefined))).toBe(
      'INTERACTIVE_HANDLER_REQUIRED',
    );
    expect(interactiveHandler(disabled, handler)).toBeUndefined();
    expect(interactiveHandler(pending, handler)).toBeUndefined();
    expect(interactiveHandler(inert, undefined)).toBeUndefined();
    expect(errorCode(() => interactiveHandler(inert, handler))).toBe(
      'INERT_HANDLER_FORBIDDEN',
    );
  });

  it('accepts only exact labeled and content-only card line shapes', () => {
    expect(errorCode(() => assertCardLines([]))).toBe('EMPTY_CARD_LINES');
    expect(() => assertCardLines([{ label: '', value: '' }])).not.toThrow();
    expect(() => assertCardLines([{ content: 'Content only' }])).not.toThrow();
    for (const lines of [
      [null],
      [[]],
      [new Date('2026-08-01T00:00:00Z')],
      [{}],
      [{ label: 'Label' }],
      [{ value: 'Value' }],
      [{ content: 'Content', label: 'Label', value: 'Value' }],
      [{ label: 'Label', value: 'Value', extra: true }],
      [{ content: 'Content', extra: true }],
    ]) {
      expect(errorCode(() => assertCardLines(
        lines as never,
      ))).toBe('INVALID_PRIMITIVE_PRESENTATION');
    }
  });

  it('enforces exact retry presentation and handler rules', () => {
    const terminal = resolveContentFeedback({ kind: 'terminal-error' });
    const recoverable = resolveContentFeedback({
      kind: 'recoverable-error',
    });
    const enabled = resolveControlFeedback({
      availability: 'enabled',
      preserveToneWhenDisabled: false,
    });
    const pending = resolveControlFeedback({
      availability: 'pending',
      preserveToneWhenDisabled: false,
    });
    const inert = resolveControlFeedback({
      availability: 'inert',
      preserveToneWhenDisabled: false,
    });
    const handler = () => undefined;

    expect(errorCode(() =>
      retryHandler(terminal, 'retry', enabled, undefined),
    )).toBe('RETRY_PRESENTATION_FORBIDDEN');
    expect(errorCode(() =>
      retryHandler(terminal, undefined, undefined, handler),
    )).toBe('RETRY_HANDLER_FORBIDDEN');
    expect(errorCode(() =>
      retryHandler(recoverable, undefined, undefined, undefined),
    )).toBe('RETRY_PRESENTATION_REQUIRED');
    expect(errorCode(() =>
      retryHandler(recoverable, 'retry', enabled, undefined),
    )).toBe('RETRY_HANDLER_REQUIRED');
    expect(retryHandler(recoverable, 'retry', enabled, handler)).toBe(
      handler,
    );
    expect(retryHandler(recoverable, 'retry', pending, handler)).toBeUndefined();
    expect(errorCode(() =>
      retryHandler(recoverable, 'retry', inert, handler),
    )).toBe('RETRY_HANDLER_FORBIDDEN');
  });

  it('has only the exact frozen closed errors', () => {
    expect(PRESENTATION_PRIMITIVE_ERROR_CODES).toEqual([
      'INVALID_PRIMITIVE_PRESENTATION',
      'CONTROL_SURFACE_MISMATCH',
      'STATE_SURFACE_MISMATCH',
      'INTERACTIVE_HANDLER_REQUIRED',
      'INERT_HANDLER_FORBIDDEN',
      'EMPTY_CARD_LINES',
      'RETRY_PRESENTATION_REQUIRED',
      'RETRY_PRESENTATION_FORBIDDEN',
      'RETRY_HANDLER_REQUIRED',
      'RETRY_HANDLER_FORBIDDEN',
    ]);
    expect(Object.isFrozen(PRESENTATION_PRIMITIVE_ERROR_CODES)).toBe(true);
    expect(Object.isFrozen(
      new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION'),
    )).toBe(true);
  });
});
