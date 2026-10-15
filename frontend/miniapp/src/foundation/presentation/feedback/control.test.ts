import { describe, expect, it } from 'vitest';

import { PRESENTATION_AVAILABILITIES } from '../model';
import {
  CONTROL_FEEDBACK_ERROR_CODES,
  ControlFeedbackError,
  resolveControlFeedback,
} from './control';

function code(input: unknown): string {
  try {
    resolveControlFeedback(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ControlFeedbackError);
    return (error as ControlFeedbackError).code;
  }
  throw new Error('Expected control feedback error.');
}

describe('control feedback presentation', () => {
  it('resolves the exact four availability mappings', () => {
    expect(resolveControlFeedback({
      availability: 'enabled',
      preserveToneWhenDisabled: false,
    })).toEqual({
      availability: 'enabled',
      interactive: true,
      nativeDisabled: false,
      ariaDisabled: false,
      ariaBusy: false,
      visualTreatment: 'full',
      progress: 'none',
      live: 'off',
    });
    expect(resolveControlFeedback({
      availability: 'disabled',
      preserveToneWhenDisabled: false,
    })).toMatchObject({
      interactive: false,
      nativeDisabled: true,
      ariaDisabled: true,
      ariaBusy: false,
      visualTreatment: 'muted',
      progress: 'none',
      live: 'off',
    });
    expect(resolveControlFeedback({
      availability: 'inert',
      preserveToneWhenDisabled: false,
    })).toMatchObject({
      interactive: false,
      nativeDisabled: true,
      ariaDisabled: true,
      ariaBusy: false,
      visualTreatment: 'full',
      progress: 'none',
      live: 'off',
    });
    expect(resolveControlFeedback({
      availability: 'pending',
      preserveToneWhenDisabled: false,
    })).toMatchObject({
      interactive: false,
      nativeDisabled: true,
      ariaDisabled: true,
      ariaBusy: true,
      visualTreatment: 'full',
      progress: 'spinner',
      live: 'polite',
    });
  });

  it('changes only disabled visual treatment for preservation', () => {
    const muted = resolveControlFeedback({
      availability: 'disabled',
      preserveToneWhenDisabled: false,
    });
    const full = resolveControlFeedback({
      availability: 'disabled',
      preserveToneWhenDisabled: true,
    });
    expect({ ...muted, visualTreatment: full.visualTreatment }).toEqual(full);
    expect(muted.visualTreatment).toBe('muted');
    expect(full.visualTreatment).toBe('full');
  });

  it('returns frozen stable identities for all eight input pairs', () => {
    for (const availability of PRESENTATION_AVAILABILITIES) {
      for (const preserveToneWhenDisabled of [false, true] as const) {
        const request = { availability, preserveToneWhenDisabled };
        const first = resolveControlFeedback(request);
        expect(resolveControlFeedback(request)).toBe(first);
        expect(Object.isFrozen(first)).toBe(true);
      }
    }
  });

  it('does not mutate input or expose semantic or execution data', () => {
    const input = {
      availability: 'pending',
      preserveToneWhenDisabled: true,
    } as const;
    const result = resolveControlFeedback(input);
    expect(input).toEqual({
      availability: 'pending',
      preserveToneWhenDisabled: true,
    });
    expect(Object.keys(result).sort()).toEqual([
      'ariaBusy',
      'ariaDisabled',
      'availability',
      'interactive',
      'live',
      'nativeDisabled',
      'progress',
      'visualTreatment',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /token|callback|control|state|text/i,
    );
  });

  it('rejects exact invalid boundaries with closed codes', () => {
    expect(code(null)).toBe('INVALID_CONTROL_FEEDBACK_REQUEST');
    expect(code([])).toBe('INVALID_CONTROL_FEEDBACK_REQUEST');
    expect(code({
      availability: 'enabled',
      preserveToneWhenDisabled: false,
      label: 'x',
    })).toBe('UNKNOWN_CONTROL_FEEDBACK_FIELD');
    expect(code({
      availability: 'loading',
      preserveToneWhenDisabled: false,
    })).toBe('INVALID_CONTROL_FEEDBACK_AVAILABILITY');
    expect(code({
      availability: 'enabled',
      preserveToneWhenDisabled: 0,
    })).toBe('INVALID_CONTROL_FEEDBACK_PRESERVATION');
    expect(CONTROL_FEEDBACK_ERROR_CODES).toEqual([
      'INVALID_CONTROL_FEEDBACK_REQUEST',
      'UNKNOWN_CONTROL_FEEDBACK_FIELD',
      'INVALID_CONTROL_FEEDBACK_AVAILABILITY',
      'INVALID_CONTROL_FEEDBACK_PRESERVATION',
    ]);
  });
});
