import {
  definePresentationRecipe,
  isPresentationRecipeOwned,
  type PresentationRecipe,
} from '../model';
import {
  CONTROL_SEMANTIC_KEYS,
  CONTROL_SURFACES,
  type ControlSemanticKey,
  type ControlSurface,
} from './keys';

export type ControlRecipeEntry = Readonly<{
  key: ControlSemanticKey;
  surface: ControlSurface;
  recipe: PresentationRecipe;
}>;

export const CONTROL_REGISTRY_ERROR_CODES = Object.freeze([
  'INVALID_CONTROL_REGISTRY_ENTRY',
  'DUPLICATE_CONTROL_RECIPE',
  'MISSING_CONTROL_RECIPE',
  'UNEXPECTED_CONTROL_RECIPE',
  'RECIPE_SURFACE_MISMATCH',
] as const);

export type ControlRegistryErrorCode =
  typeof CONTROL_REGISTRY_ERROR_CODES[number];

export class ControlRegistryError extends Error {
  readonly code: ControlRegistryErrorCode;

  constructor(code: ControlRegistryErrorCode) {
    super(code);
    this.name = 'ControlRegistryError';
    this.code = code;
  }
}

const expectedPairs = Object.freeze([
  ['navigation-back', 'action-button'],
  ['navigation-next', 'action-button'],
  ['navigation-open', 'action-button'],
  ['navigation-open', 'list-button'],
  ['selection-primary', 'action-button'],
  ['selection-primary', 'list-button'],
  ['selection-secondary', 'action-button'],
  ['selection-secondary', 'list-button'],
  ['action-positive', 'action-button'],
  ['action-positive-neutral-context', 'action-button'],
  ['action-warning', 'action-button'],
  ['action-danger', 'action-button'],
  ['action-neutral', 'action-button'],
  ['action-cancel', 'action-button'],
  ['action-reject', 'action-button'],
  ['action-reversal', 'action-button'],
] as const);

function recipe(
  surface: ControlSurface,
  intent: ControlRecipeEntry['recipe']['intent'],
  emphasis: ControlRecipeEntry['recipe']['emphasis'],
  fill: ControlRecipeEntry['recipe']['fill'],
  borderTone: ControlRecipeEntry['recipe']['borderTone'],
  textTone: ControlRecipeEntry['recipe']['textTone'],
): PresentationRecipe {
  return definePresentationRecipe({
    surface,
    intent,
    emphasis,
    fill,
    borderTone,
    textTone,
    preserveStateToneWhenDisabled: false,
  });
}

const entries = [
  { key: 'navigation-back', surface: 'action-button', recipe: recipe('action-button', 'navigation', 'secondary', { mode: 'outline', tone: 'info' }, 'info', 'info') },
  { key: 'navigation-next', surface: 'action-button', recipe: recipe('action-button', 'navigation', 'primary', { mode: 'solid', tone: 'info' }, 'info', 'inverse') },
  { key: 'navigation-open', surface: 'action-button', recipe: recipe('action-button', 'navigation', 'primary', { mode: 'soft', tone: 'info' }, 'info', 'info') },
  { key: 'navigation-open', surface: 'list-button', recipe: recipe('list-button', 'navigation', 'primary', { mode: 'soft', tone: 'info' }, 'info', 'info') },
  { key: 'selection-primary', surface: 'action-button', recipe: recipe('action-button', 'selection', 'primary', { mode: 'soft', tone: 'info' }, 'info', 'info') },
  { key: 'selection-primary', surface: 'list-button', recipe: recipe('list-button', 'selection', 'primary', { mode: 'soft', tone: 'info' }, 'info', 'info') },
  { key: 'selection-secondary', surface: 'action-button', recipe: recipe('action-button', 'selection', 'secondary', { mode: 'outline', tone: 'info' }, 'info', 'info') },
  { key: 'selection-secondary', surface: 'list-button', recipe: recipe('list-button', 'selection', 'secondary', { mode: 'outline', tone: 'info' }, 'info', 'info') },
  { key: 'action-positive', surface: 'action-button', recipe: recipe('action-button', 'positive', 'primary', { mode: 'soft', tone: 'positive' }, 'positive', 'positive') },
  { key: 'action-positive-neutral-context', surface: 'action-button', recipe: recipe('action-button', 'positive', 'primary', { mode: 'soft', tone: 'neutral' }, 'positive', 'positive') },
  { key: 'action-warning', surface: 'action-button', recipe: recipe('action-button', 'warning', 'primary', { mode: 'soft', tone: 'warning' }, 'warning', 'warning') },
  { key: 'action-danger', surface: 'action-button', recipe: recipe('action-button', 'danger', 'primary', { mode: 'soft', tone: 'danger' }, 'danger', 'danger') },
  { key: 'action-neutral', surface: 'action-button', recipe: recipe('action-button', 'neutral', 'primary', { mode: 'soft', tone: 'neutral' }, 'neutral', 'neutral') },
  { key: 'action-cancel', surface: 'action-button', recipe: recipe('action-button', 'cancel', 'secondary', { mode: 'soft', tone: 'warning' }, 'warning', 'warning') },
  { key: 'action-reject', surface: 'action-button', recipe: recipe('action-button', 'reject', 'primary', { mode: 'soft', tone: 'warning' }, 'warning', 'warning') },
  { key: 'action-reversal', surface: 'action-button', recipe: recipe('action-button', 'reversal', 'primary', { mode: 'soft', tone: 'danger' }, 'danger', 'danger') },
] as const;

function isControlSemanticKey(value: unknown): value is ControlSemanticKey {
  return typeof value === 'string' && CONTROL_SEMANTIC_KEYS.includes(value as ControlSemanticKey);
}

function isControlSurface(value: unknown): value is ControlSurface {
  return typeof value === 'string' && CONTROL_SURFACES.includes(value as ControlSurface);
}

function pairId(key: ControlSemanticKey, surface: ControlSurface): string {
  return `${key}:${surface}`;
}

function validateRegistry(value: readonly unknown[]): readonly ControlRecipeEntry[] {
  const foundPairs = new Set<string>();
  const foundKeys = new Set<ControlSemanticKey>();
  const expected = new Set(expectedPairs.map(([key, surface]) => pairId(key, surface)));

  for (const entry of value) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      Array.isArray(entry) ||
      !('key' in entry) ||
      !('surface' in entry) ||
      !('recipe' in entry)
    ) {
      throw new ControlRegistryError('INVALID_CONTROL_REGISTRY_ENTRY');
    }

    const candidate = entry as Readonly<Record<string, unknown>>;
    if (!isControlSemanticKey(candidate.key) || !isControlSurface(candidate.surface)) {
      throw new ControlRegistryError('INVALID_CONTROL_REGISTRY_ENTRY');
    }
    if (!isPresentationRecipeOwned(candidate.recipe as PresentationRecipe)) {
      throw new ControlRegistryError('INVALID_CONTROL_REGISTRY_ENTRY');
    }
    if ((candidate.recipe as PresentationRecipe).surface !== candidate.surface) {
      throw new ControlRegistryError('RECIPE_SURFACE_MISMATCH');
    }

    const id = pairId(candidate.key, candidate.surface);
    if (foundPairs.has(id)) {
      throw new ControlRegistryError('DUPLICATE_CONTROL_RECIPE');
    }
    if (!expected.has(id)) {
      throw new ControlRegistryError('UNEXPECTED_CONTROL_RECIPE');
    }
    foundPairs.add(id);
    foundKeys.add(candidate.key);
  }

  for (const [key, surface] of expectedPairs) {
    if (!foundPairs.has(pairId(key, surface))) {
      throw new ControlRegistryError('MISSING_CONTROL_RECIPE');
    }
  }
  for (const key of CONTROL_SEMANTIC_KEYS) {
    if (!foundKeys.has(key)) {
      throw new ControlRegistryError('MISSING_CONTROL_RECIPE');
    }
  }

  return Object.freeze(value.map((entry) => Object.freeze(entry as ControlRecipeEntry)));
}

export const CONTROL_RECIPE_ENTRIES = validateRegistry(entries);

export function supportedControlSurfaces(
  key: ControlSemanticKey,
): readonly ControlSurface[] {
  return Object.freeze(
    CONTROL_RECIPE_ENTRIES
      .filter((entry) => entry.key === key)
      .map((entry) => entry.surface),
  );
}
