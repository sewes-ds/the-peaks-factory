import { describe, expect, it } from 'vitest';

import { CONTROL_SEMANTIC_KEYS } from './keys';
import {
  CONTROL_RECIPE_ENTRIES,
  supportedControlSurfaces,
} from './registry';

const expected = [
  ['navigation-back', 'action-button', 'navigation', 'secondary', 'outline', 'info', 'info', 'info'],
  ['navigation-next', 'action-button', 'navigation', 'primary', 'solid', 'info', 'info', 'inverse'],
  ['navigation-open', 'action-button', 'navigation', 'primary', 'soft', 'info', 'info', 'info'],
  ['navigation-open', 'list-button', 'navigation', 'primary', 'soft', 'info', 'info', 'info'],
  ['selection-primary', 'action-button', 'selection', 'primary', 'soft', 'info', 'info', 'info'],
  ['selection-primary', 'list-button', 'selection', 'primary', 'soft', 'info', 'info', 'info'],
  ['selection-secondary', 'action-button', 'selection', 'secondary', 'outline', 'info', 'info', 'info'],
  ['selection-secondary', 'list-button', 'selection', 'secondary', 'outline', 'info', 'info', 'info'],
  ['action-positive', 'action-button', 'positive', 'primary', 'soft', 'positive', 'positive', 'positive'],
  ['action-positive-neutral-context', 'action-button', 'positive', 'primary', 'soft', 'neutral', 'positive', 'positive'],
  ['action-warning', 'action-button', 'warning', 'primary', 'soft', 'warning', 'warning', 'warning'],
  ['action-danger', 'action-button', 'danger', 'primary', 'soft', 'danger', 'danger', 'danger'],
  ['action-neutral', 'action-button', 'neutral', 'primary', 'soft', 'neutral', 'neutral', 'neutral'],
  ['action-cancel', 'action-button', 'cancel', 'secondary', 'soft', 'warning', 'warning', 'warning'],
  ['action-reject', 'action-button', 'reject', 'primary', 'soft', 'warning', 'warning', 'warning'],
  ['action-reversal', 'action-button', 'reversal', 'primary', 'soft', 'danger', 'danger', 'danger'],
] as const;

describe('sealed global control registry', () => {
  it('contains exactly the 16 allowed key and surface recipes', () => {
    expect(CONTROL_RECIPE_ENTRIES).toHaveLength(16);
    expect(CONTROL_RECIPE_ENTRIES.map((entry) => [
      entry.key, entry.surface, entry.recipe.intent, entry.recipe.emphasis,
      entry.recipe.fill.mode, entry.recipe.fill.tone, entry.recipe.borderTone, entry.recipe.textTone,
    ])).toEqual(expected);
    expect(new Set(CONTROL_RECIPE_ENTRIES.map((entry) => `${entry.key}:${entry.surface}`)).size).toBe(16);
  });

  it('represents every key with exact supported surfaces and frozen recipes', () => {
    expect(new Set(CONTROL_RECIPE_ENTRIES.map((entry) => entry.key))).toEqual(new Set(CONTROL_SEMANTIC_KEYS));
    expect(supportedControlSurfaces('navigation-open')).toEqual(['action-button', 'list-button']);
    expect(supportedControlSurfaces('selection-primary')).toEqual(['action-button', 'list-button']);
    expect(supportedControlSurfaces('selection-secondary')).toEqual(['action-button', 'list-button']);
    expect(supportedControlSurfaces('action-danger')).toEqual(['action-button']);
    expect(Object.isFrozen(CONTROL_RECIPE_ENTRIES)).toBe(true);
    for (const entry of CONTROL_RECIPE_ENTRIES) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.recipe)).toBe(true);
      expect(Object.isFrozen(entry.recipe.fill)).toBe(true);
      expect(entry.recipe.surface).toBe(entry.surface);
      expect(entry.recipe.preserveStateToneWhenDisabled).toBe(false);
    }
  });

  it('proves neutral fill plus positive border and text without a domain key', () => {
    const entry = CONTROL_RECIPE_ENTRIES.find((candidate) => candidate.key === 'action-positive-neutral-context');

    expect(entry?.recipe).toMatchObject({
      fill: { mode: 'soft', tone: 'neutral' },
      borderTone: 'positive',
      textTone: 'positive',
    });
  });
});
