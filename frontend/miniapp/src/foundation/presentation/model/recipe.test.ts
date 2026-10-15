import { describe, expect, it } from 'vitest';

import {
  definePresentationRecipe,
  PresentationContractError,
  PRESENTATION_CONTRACT_ERROR_CODES,
} from './recipe';

const validInput = {
  surface: 'action-button',
  intent: 'positive',
  emphasis: 'primary',
  fill: { mode: 'soft', tone: 'neutral' },
  borderTone: 'positive',
  textTone: 'positive',
  preserveStateToneWhenDisabled: true,
} as const;

function errorCode(input: unknown): string {
  try {
    definePresentationRecipe(input);
  } catch (error) {
    expect(error).toBeInstanceOf(PresentationContractError);
    return (error as PresentationContractError).code;
  }

  throw new Error('Expected a presentation contract error.');
}

describe('global presentation recipes', () => {
  it('accepts independent neutral fill with positive border and text', () => {
    const recipe = definePresentationRecipe(validInput);

    expect(recipe).toEqual(validInput);
    expect(recipe.fill.tone).toBe('neutral');
    expect(recipe.borderTone).toBe('positive');
    expect(recipe.textTone).toBe('positive');
  });

  it('deeply freezes accepted output without mutating input', () => {
    const input = {
      ...validInput,
      fill: { ...validInput.fill },
    };
    const recipe = definePresentationRecipe(input);

    expect(Object.isFrozen(recipe)).toBe(true);
    expect(Object.isFrozen(recipe.fill)).toBe(true);
    expect(input).toEqual(validInput);
    expect(input.fill).not.toBe(recipe.fill);
  });

  it('rejects every invalid boundary with a stable exact code', () => {
    expect(errorCode({ ...validInput, extra: true })).toBe('UNKNOWN_RECIPE_FIELD');
    expect(errorCode({ ...validInput, fill: { ...validInput.fill, extra: true } })).toBe('UNKNOWN_RECIPE_FILL_FIELD');
    expect(errorCode({ ...validInput, surface: 'button' })).toBe('INVALID_PRESENTATION_SURFACE');
    expect(errorCode({ ...validInput, intent: 'primaryBlue' })).toBe('INVALID_PRESENTATION_INTENT');
    expect(errorCode({ ...validInput, emphasis: 'main' })).toBe('INVALID_PRESENTATION_EMPHASIS');
    expect(errorCode({ ...validInput, fill: { ...validInput.fill, mode: 'filled' } })).toBe('INVALID_PRESENTATION_FILL_MODE');
    expect(errorCode({ ...validInput, fill: { ...validInput.fill, tone: 'blue' } })).toBe('INVALID_PRESENTATION_TONE');
    expect(errorCode({ ...validInput, borderTone: 'blue' })).toBe('INVALID_PRESENTATION_TONE');
    expect(errorCode({ ...validInput, textTone: 'gray' })).toBe('INVALID_PRESENTATION_TEXT_TONE');
    expect(errorCode({ ...validInput, preserveStateToneWhenDisabled: 'true' })).toBe('INVALID_DISABLED_STATE_POLICY');
    expect(errorCode({ ...validInput, fill: [] })).toBe('INVALID_RECIPE_FILL');
    expect(errorCode(null)).toBe('INVALID_RECIPE_OBJECT');
    expect(errorCode([])).toBe('INVALID_RECIPE_OBJECT');
    expect(errorCode('recipe')).toBe('INVALID_RECIPE_OBJECT');
  });

  it('has no generic fallback error code', () => {
    expect(PRESENTATION_CONTRACT_ERROR_CODES).toEqual([
      'INVALID_RECIPE_OBJECT',
      'UNKNOWN_RECIPE_FIELD',
      'INVALID_RECIPE_FILL',
      'UNKNOWN_RECIPE_FILL_FIELD',
      'INVALID_PRESENTATION_SURFACE',
      'INVALID_PRESENTATION_INTENT',
      'INVALID_PRESENTATION_EMPHASIS',
      'INVALID_PRESENTATION_FILL_MODE',
      'INVALID_PRESENTATION_TONE',
      'INVALID_PRESENTATION_TEXT_TONE',
      'INVALID_DISABLED_STATE_POLICY',
    ]);
  });
});
