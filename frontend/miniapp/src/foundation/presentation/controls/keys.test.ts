import { describe, expect, it } from 'vitest';

import {
  CONTROL_SEMANTIC_KEYS,
  CONTROL_SURFACES,
} from './keys';

describe('global control keys', () => {
  it('declares the exact closed generic key taxonomy', () => {
    expect(CONTROL_SEMANTIC_KEYS).toEqual([
      'navigation-back', 'navigation-next', 'navigation-open', 'selection-primary', 'selection-secondary',
      'action-positive', 'action-positive-neutral-context', 'action-warning', 'action-danger',
      'action-neutral', 'action-cancel', 'action-reject', 'action-reversal',
    ]);
    expect(CONTROL_SURFACES).toEqual(['action-button', 'list-button']);
  });

  it('freezes non-empty unique keys and surfaces', () => {
    for (const values of [CONTROL_SEMANTIC_KEYS, CONTROL_SURFACES]) {
      expect(Object.isFrozen(values)).toBe(true);
      expect(values.every((value) => value.length > 0)).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
