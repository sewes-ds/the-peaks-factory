import {
  STATE_PRESENTATION_KEYS,
  STATE_PRESENTATION_SURFACES,
  type StatePresentationKey,
  type StatePresentationSurface,
} from './keys';
import type { StatePresentation } from './model';
import { STATE_PRESENTATION_ENTRIES } from './registry';

export const STATE_RESOLVER_ERROR_CODES = Object.freeze([
  'INVALID_STATE_REQUEST_OBJECT',
  'UNKNOWN_STATE_REQUEST_FIELD',
  'INVALID_STATE_KEY',
  'INVALID_STATE_SURFACE',
  'STATE_PRESENTATION_NOT_FOUND',
] as const);
export type StateResolverErrorCode = typeof STATE_RESOLVER_ERROR_CODES[number];
export class StateResolverError extends Error {
  readonly code: StateResolverErrorCode;
  constructor(code: StateResolverErrorCode) { super(code); this.name = 'StateResolverError'; this.code = code; }
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isKey(value: unknown): value is StatePresentationKey { return typeof value === 'string' && STATE_PRESENTATION_KEYS.includes(value as StatePresentationKey); }
function isSurface(value: unknown): value is StatePresentationSurface { return typeof value === 'string' && STATE_PRESENTATION_SURFACES.includes(value as StatePresentationSurface); }
export function resolveStatePresentation(input: unknown): StatePresentation {
  if (!isPlainObject(input)) throw new StateResolverError('INVALID_STATE_REQUEST_OBJECT');
  for (const field of Object.keys(input)) if (field !== 'key' && field !== 'surface') throw new StateResolverError('UNKNOWN_STATE_REQUEST_FIELD');
  if (!isKey(input.key)) throw new StateResolverError('INVALID_STATE_KEY');
  if (!isSurface(input.surface)) throw new StateResolverError('INVALID_STATE_SURFACE');
  const result = STATE_PRESENTATION_ENTRIES.find((entry) => entry.key === input.key && entry.surface === input.surface);
  if (result === undefined) throw new StateResolverError('STATE_PRESENTATION_NOT_FOUND');
  return result;
}
