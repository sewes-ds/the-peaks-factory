import {
  PRESENTATION_EMPHASES,
  PRESENTATION_FILL_MODES,
  PRESENTATION_INTENTS,
  PRESENTATION_SURFACES,
  PRESENTATION_TEXT_TONES,
  PRESENTATION_TONES,
  type PresentationEmphasis,
  type PresentationFillMode,
  type PresentationIntent,
  type PresentationSurface,
  type PresentationTextTone,
  type PresentationTone,
} from './semantics';

export type PresentationRecipeInput = Readonly<{
  surface: PresentationSurface;
  intent: PresentationIntent;
  emphasis: PresentationEmphasis;
  fill: Readonly<{
    mode: PresentationFillMode;
    tone: PresentationTone;
  }>;
  borderTone: PresentationTone;
  textTone: PresentationTextTone;
  preserveStateToneWhenDisabled: boolean;
}>;

export type PresentationRecipe = Readonly<{
  surface: PresentationSurface;
  intent: PresentationIntent;
  emphasis: PresentationEmphasis;
  fill: Readonly<{
    mode: PresentationFillMode;
    tone: PresentationTone;
  }>;
  borderTone: PresentationTone;
  textTone: PresentationTextTone;
  preserveStateToneWhenDisabled: boolean;
}>;

export const PRESENTATION_CONTRACT_ERROR_CODES = Object.freeze([
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
] as const);

export type PresentationContractErrorCode =
  typeof PRESENTATION_CONTRACT_ERROR_CODES[number];

export class PresentationContractError extends Error {
  readonly code: PresentationContractErrorCode;

  constructor(code: PresentationContractErrorCode) {
    super(code);
    this.name = 'PresentationContractError';
    this.code = code;
  }
}

const ownedPresentationRecipes = new WeakSet<object>();

export function isPresentationRecipeOwned(
  recipe: PresentationRecipe,
): boolean {
  return ownedPresentationRecipes.has(recipe);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: PresentationContractErrorCode,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new PresentationContractError(code);
    }
  }
}

function readEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  code: PresentationContractErrorCode,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new PresentationContractError(code);
  }

  return value as T;
}

export function definePresentationRecipe(input: unknown): PresentationRecipe {
  if (!isPlainObject(input)) {
    throw new PresentationContractError('INVALID_RECIPE_OBJECT');
  }

  rejectUnknownFields(
    input,
    [
      'surface',
      'intent',
      'emphasis',
      'fill',
      'borderTone',
      'textTone',
      'preserveStateToneWhenDisabled',
    ],
    'UNKNOWN_RECIPE_FIELD',
  );

  if (!isPlainObject(input.fill)) {
    throw new PresentationContractError('INVALID_RECIPE_FILL');
  }

  rejectUnknownFields(
    input.fill,
    ['mode', 'tone'],
    'UNKNOWN_RECIPE_FILL_FIELD',
  );

  if (typeof input.preserveStateToneWhenDisabled !== 'boolean') {
    throw new PresentationContractError('INVALID_DISABLED_STATE_POLICY');
  }

  const fill = Object.freeze({
    mode: readEnum(
      input.fill.mode,
      PRESENTATION_FILL_MODES,
      'INVALID_PRESENTATION_FILL_MODE',
    ),
    tone: readEnum(
      input.fill.tone,
      PRESENTATION_TONES,
      'INVALID_PRESENTATION_TONE',
    ),
  });

  const recipe = Object.freeze({
    surface: readEnum(
      input.surface,
      PRESENTATION_SURFACES,
      'INVALID_PRESENTATION_SURFACE',
    ),
    intent: readEnum(
      input.intent,
      PRESENTATION_INTENTS,
      'INVALID_PRESENTATION_INTENT',
    ),
    emphasis: readEnum(
      input.emphasis,
      PRESENTATION_EMPHASES,
      'INVALID_PRESENTATION_EMPHASIS',
    ),
    fill,
    borderTone: readEnum(
      input.borderTone,
      PRESENTATION_TONES,
      'INVALID_PRESENTATION_TONE',
    ),
    textTone: readEnum(
      input.textTone,
      PRESENTATION_TEXT_TONES,
      'INVALID_PRESENTATION_TEXT_TONE',
    ),
    preserveStateToneWhenDisabled: input.preserveStateToneWhenDisabled,
  });

  ownedPresentationRecipes.add(recipe);
  return recipe;
}
