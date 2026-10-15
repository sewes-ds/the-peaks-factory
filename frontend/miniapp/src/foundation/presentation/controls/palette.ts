import {
  isPresentationRecipeOwned,
  type PresentationRecipe,
} from '../model';
import {
  resolvePresentationBorderToken,
  resolvePresentationFillToken,
  resolvePresentationTextToken,
  type PresentationPaintToken,
} from '../palette';

export type ControlBackgroundToken = PresentationPaintToken;

export type ResolvedControlTokens = Readonly<{
  background: ControlBackgroundToken;
  border: Exclude<PresentationPaintToken, 'transparent'>;
  text: Exclude<PresentationPaintToken, 'transparent'>;
}>;

export const CONTROL_PALETTE_ERROR_CODES = Object.freeze([
  'RECIPE_NOT_OWNED',
] as const);

export type ControlPaletteErrorCode =
  typeof CONTROL_PALETTE_ERROR_CODES[number];

export class ControlPaletteError extends Error {
  readonly code: ControlPaletteErrorCode;

  constructor(code: ControlPaletteErrorCode) {
    super(code);
    this.name = 'ControlPaletteError';
    this.code = code;
  }
}

const resolvedTokens = new WeakMap<PresentationRecipe, ResolvedControlTokens>();

function backgroundFor(recipe: PresentationRecipe): ControlBackgroundToken {
  return resolvePresentationFillToken(recipe.fill.mode, recipe.fill.tone);
}

export function resolvePresentationRecipeTokens(
  recipe: PresentationRecipe,
): ResolvedControlTokens {
  if (!isPresentationRecipeOwned(recipe)) {
    throw new ControlPaletteError('RECIPE_NOT_OWNED');
  }

  const existing = resolvedTokens.get(recipe);
  if (existing !== undefined) {
    return existing;
  }

  const tokens = Object.freeze({
    background: backgroundFor(recipe),
    border: resolvePresentationBorderToken(recipe.borderTone),
    text: resolvePresentationTextToken(recipe.textTone),
  });

  resolvedTokens.set(recipe, tokens);
  return tokens;
}
