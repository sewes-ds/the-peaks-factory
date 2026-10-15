import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_AVAILABILITIES,
  PRESENTATION_EMPHASES,
  PRESENTATION_FILL_MODES,
  PRESENTATION_INTENTS,
  PRESENTATION_SURFACES,
  PRESENTATION_TEXT_TONES,
  PRESENTATION_TONES,
} from './semantics';

const tuples = [
  PRESENTATION_INTENTS,
  PRESENTATION_TONES,
  PRESENTATION_SURFACES,
  PRESENTATION_EMPHASES,
  PRESENTATION_AVAILABILITIES,
  PRESENTATION_FILL_MODES,
  PRESENTATION_TEXT_TONES,
] as const;

describe('global presentation semantics', () => {
  it('declares the exact closed members in order', () => {
    expect(PRESENTATION_INTENTS).toEqual([
      'navigation', 'selection', 'positive', 'warning', 'danger', 'neutral', 'cancel', 'reject', 'reversal',
    ]);
    expect(PRESENTATION_TONES).toEqual(['info', 'positive', 'warning', 'danger', 'neutral', 'inactive']);
    expect(PRESENTATION_SURFACES).toEqual(['action-button', 'list-button', 'entity-row', 'card', 'summary-line', 'message']);
    expect(PRESENTATION_EMPHASES).toEqual(['primary', 'secondary', 'tertiary']);
    expect(PRESENTATION_AVAILABILITIES).toEqual(['enabled', 'disabled', 'inert', 'pending']);
    expect(PRESENTATION_FILL_MODES).toEqual(['solid', 'soft', 'outline', 'transparent']);
    expect(PRESENTATION_TEXT_TONES).toEqual(['info', 'positive', 'warning', 'danger', 'neutral', 'inactive', 'inverse', 'muted']);
  });

  it('freezes every closed tuple without blanks or duplicates', () => {
    for (const tuple of tuples) {
      expect(Object.isFrozen(tuple)).toBe(true);
      expect(tuple.every((value) => value.length > 0)).toBe(true);
      expect(new Set(tuple).size).toBe(tuple.length);
    }
  });
});
