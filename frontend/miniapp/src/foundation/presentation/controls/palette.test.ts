import { describe, expect, it } from 'vitest';

import { definePresentationRecipe } from '../model';
import { PEAKS_COLOR_TOKENS } from '../tokens';
import {
  ControlPaletteError,
  resolvePresentationRecipeTokens,
} from './palette';

function recipe(
  mode: 'solid' | 'soft' | 'outline' | 'transparent',
  tone: 'info' | 'positive' | 'warning' | 'danger' | 'neutral' | 'inactive',
  textTone: 'info' | 'positive' | 'warning' | 'danger' | 'neutral' | 'inactive' | 'inverse' | 'muted' = 'info',
) {
  return definePresentationRecipe({
    surface: 'action-button',
    intent: 'neutral',
    emphasis: 'primary',
    fill: { mode, tone },
    borderTone: tone,
    textTone,
    preserveStateToneWhenDisabled: false,
  });
}

describe('global control palette', () => {
  it('resolves exact fill tokens for every tone and fill mode', () => {
    expect(resolvePresentationRecipeTokens(recipe('solid', 'info')).background).toBe(PEAKS_COLOR_TOKENS.brand.blue);
    expect(resolvePresentationRecipeTokens(recipe('soft', 'info')).background).toBe(PEAKS_COLOR_TOKENS.brand.lightBlue);
    expect(resolvePresentationRecipeTokens(recipe('solid', 'positive')).background).toBe(PEAKS_COLOR_TOKENS.brand.green);
    expect(resolvePresentationRecipeTokens(recipe('soft', 'positive')).background).toBe(PEAKS_COLOR_TOKENS.brand.lightGreen);
    for (const tone of ['warning', 'danger', 'neutral', 'inactive'] as const) {
      const expected = tone === 'warning'
        ? PEAKS_COLOR_TOKENS.yellow.fill
        : tone === 'danger'
          ? PEAKS_COLOR_TOKENS.red.fill
          : PEAKS_COLOR_TOKENS.gray.fill;
      expect(resolvePresentationRecipeTokens(recipe('solid', tone)).background).toBe(expected);
      expect(resolvePresentationRecipeTokens(recipe('soft', tone)).background).toBe(expected);
    }
    expect(resolvePresentationRecipeTokens(recipe('outline', 'danger')).background).toBe(PEAKS_COLOR_TOKENS.brand.white);
    expect(resolvePresentationRecipeTokens(recipe('transparent', 'danger')).background).toBe('transparent');
  });

  it('resolves exact border and text tokens', () => {
    const cases = [
      ['info', 'info', PEAKS_COLOR_TOKENS.brand.blue, PEAKS_COLOR_TOKENS.brand.blue],
      ['positive', 'positive', PEAKS_COLOR_TOKENS.brand.green, PEAKS_COLOR_TOKENS.brand.green],
      ['warning', 'warning', PEAKS_COLOR_TOKENS.yellow.border, PEAKS_COLOR_TOKENS.yellow.text],
      ['danger', 'danger', PEAKS_COLOR_TOKENS.red.border, PEAKS_COLOR_TOKENS.red.text],
      ['neutral', 'neutral', PEAKS_COLOR_TOKENS.gray.border, PEAKS_COLOR_TOKENS.gray.text],
      ['inactive', 'inactive', PEAKS_COLOR_TOKENS.gray.border, PEAKS_COLOR_TOKENS.foundation.muted],
    ] as const;
    for (const [tone, textTone, border, text] of cases) {
      expect(resolvePresentationRecipeTokens(recipe('soft', tone, textTone))).toMatchObject({ border, text });
    }
    expect(resolvePresentationRecipeTokens(recipe('soft', 'info', 'inverse')).text).toBe(PEAKS_COLOR_TOKENS.brand.white);
    expect(resolvePresentationRecipeTokens(recipe('soft', 'info', 'muted')).text).toBe(PEAKS_COLOR_TOKENS.foundation.muted);
  });

  it('returns frozen cached tokens for owned recipes without mutation', () => {
    const owned = recipe('soft', 'neutral', 'positive');
    const tokens = resolvePresentationRecipeTokens(owned);

    expect(Object.isFrozen(tokens)).toBe(true);
    expect(resolvePresentationRecipeTokens(owned)).toBe(tokens);
    expect(owned.fill.tone).toBe('neutral');
  });

  it('rejects structural clones as non-authoritative recipes', () => {
    const owned = recipe('soft', 'neutral');
    const clone = Object.freeze({ ...owned, fill: Object.freeze({ ...owned.fill }) });

    expect(() => resolvePresentationRecipeTokens(clone)).toThrow(
      new ControlPaletteError('RECIPE_NOT_OWNED'),
    );
  });
});
