import { type PresentationRecipe } from '../model';
import {
  resolvePresentationRecipeTokens,
  type ResolvedControlTokens,
} from './palette';
import {
  CONTROL_SEMANTIC_KEYS,
  CONTROL_SURFACES,
  type ControlSemanticKey,
  type ControlSurface,
} from './keys';
import { CONTROL_RECIPE_ENTRIES } from './registry';

export type ControlRecipeRequest = Readonly<{
  key: ControlSemanticKey;
  surface: ControlSurface;
}>;

export type ControlPresentation = Readonly<{
  key: ControlSemanticKey;
  surface: ControlSurface;
  recipe: PresentationRecipe;
  tokens: ResolvedControlTokens;
}>;

export const CONTROL_RESOLVER_ERROR_CODES = Object.freeze([
  'INVALID_CONTROL_REQUEST_OBJECT',
  'UNKNOWN_CONTROL_REQUEST_FIELD',
  'INVALID_CONTROL_KEY',
  'INVALID_CONTROL_SURFACE',
  'UNSUPPORTED_CONTROL_SURFACE',
] as const);

export type ControlResolverErrorCode =
  typeof CONTROL_RESOLVER_ERROR_CODES[number];

export class ControlResolverError extends Error {
  readonly code: ControlResolverErrorCode;

  constructor(code: ControlResolverErrorCode) {
    super(code);
    this.name = 'ControlResolverError';
    this.code = code;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isControlSemanticKey(value: unknown): value is ControlSemanticKey {
  return typeof value === 'string' && CONTROL_SEMANTIC_KEYS.includes(value as ControlSemanticKey);
}

function isControlSurface(value: unknown): value is ControlSurface {
  return typeof value === 'string' && CONTROL_SURFACES.includes(value as ControlSurface);
}

export function resolveControlPresentation(
  input: unknown,
): ControlPresentation {
  if (!isPlainObject(input)) {
    throw new ControlResolverError('INVALID_CONTROL_REQUEST_OBJECT');
  }

  for (const field of Object.keys(input)) {
    if (field !== 'key' && field !== 'surface') {
      throw new ControlResolverError('UNKNOWN_CONTROL_REQUEST_FIELD');
    }
  }
  if (!isControlSemanticKey(input.key)) {
    throw new ControlResolverError('INVALID_CONTROL_KEY');
  }
  if (!isControlSurface(input.surface)) {
    throw new ControlResolverError('INVALID_CONTROL_SURFACE');
  }

  const entry = CONTROL_RECIPE_ENTRIES.find(
    (candidate) => candidate.key === input.key && candidate.surface === input.surface,
  );
  if (entry === undefined) {
    throw new ControlResolverError('UNSUPPORTED_CONTROL_SURFACE');
  }

  return Object.freeze({
    key: entry.key,
    surface: entry.surface,
    recipe: entry.recipe,
    tokens: resolvePresentationRecipeTokens(entry.recipe),
  });
}
