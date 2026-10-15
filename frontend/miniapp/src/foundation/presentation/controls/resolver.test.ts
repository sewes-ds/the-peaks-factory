import { describe, expect, it } from 'vitest';

import { CONTROL_RECIPE_ENTRIES } from './registry';
import {
  ControlResolverError,
  resolveControlPresentation,
} from './resolver';

function errorCode(input: unknown): string {
  try {
    resolveControlPresentation(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ControlResolverError);
    return (error as ControlResolverError).code;
  }
  throw new Error('Expected a control resolver error.');
}

describe('sealed global control resolver', () => {
  it('resolves every exact supported key and surface', () => {
    for (const entry of CONTROL_RECIPE_ENTRIES) {
      const presentation = resolveControlPresentation({ key: entry.key, surface: entry.surface });
      expect(presentation.recipe).toBe(entry.recipe);
      expect(Object.isFrozen(presentation)).toBe(true);
      expect(Object.isFrozen(presentation.tokens)).toBe(true);
    }
  });

  it('rejects unknown boundary values and unsupported surfaces with exact codes', () => {
    expect(errorCode(null)).toBe('INVALID_CONTROL_REQUEST_OBJECT');
    expect(errorCode([])).toBe('INVALID_CONTROL_REQUEST_OBJECT');
    expect(errorCode('request')).toBe('INVALID_CONTROL_REQUEST_OBJECT');
    expect(errorCode({ key: 'navigation-back', surface: 'action-button', label: 'Back' })).toBe('UNKNOWN_CONTROL_REQUEST_FIELD');
    expect(errorCode({ key: 'unknown', surface: 'action-button' })).toBe('INVALID_CONTROL_KEY');
    expect(errorCode({ key: 'navigation-back', surface: 'card' })).toBe('INVALID_CONTROL_SURFACE');
    expect(errorCode({ key: 'action-positive', surface: 'list-button' })).toBe('UNSUPPORTED_CONTROL_SURFACE');
  });

  it('does not accept raw visual or execution fields and preserves registry identities', () => {
    const input = { key: 'action-positive-neutral-context', surface: 'action-button' } as const;
    const first = resolveControlPresentation(input);
    const second = resolveControlPresentation(input);

    expect(first.recipe).toBe(second.recipe);
    expect(first.tokens).toBe(second.tokens);
    expect(input).toEqual({ key: 'action-positive-neutral-context', surface: 'action-button' });
    expect(errorCode({ ...input, recipe: {} })).toBe('UNKNOWN_CONTROL_REQUEST_FIELD');
    expect(errorCode({ ...input, variant: 'button' })).toBe('UNKNOWN_CONTROL_REQUEST_FIELD');
    expect(errorCode({ ...input, color: 'blue' })).toBe('UNKNOWN_CONTROL_REQUEST_FIELD');
    expect(errorCode({ ...input, icon: 'arrow' })).toBe('UNKNOWN_CONTROL_REQUEST_FIELD');
    expect(errorCode({ ...input, callback: () => undefined })).toBe('UNKNOWN_CONTROL_REQUEST_FIELD');
  });
});
