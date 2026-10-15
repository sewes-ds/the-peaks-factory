import type { PresentationTone } from '../model';
import {
  resolvePresentationBorderToken,
  resolvePresentationFillToken,
  resolvePresentationTextToken,
} from '../palette';
import {
  STATE_PRESENTATION_KEYS,
  STATE_PRESENTATION_SURFACES,
  type StatePresentationKey,
  type StatePresentationSurface,
} from './keys';
import type { StateFillMode, StatePresentation } from './model';

export const STATE_REGISTRY_ERROR_CODES = Object.freeze([
  'INVALID_STATE_REGISTRY_ENTRY',
  'DUPLICATE_STATE_PRESENTATION',
  'MISSING_STATE_PRESENTATION',
  'UNEXPECTED_STATE_PRESENTATION',
  'STATE_TONE_MISMATCH',
  'STATE_SURFACE_MISMATCH',
  'STATE_TOKEN_MISMATCH',
  'INVALID_STATE_DISABLED_POLICY',
] as const);

export type StateRegistryErrorCode = typeof STATE_REGISTRY_ERROR_CODES[number];

export class StateRegistryError extends Error {
  readonly code: StateRegistryErrorCode;
  constructor(code: StateRegistryErrorCode) {
    super(code);
    this.name = 'StateRegistryError';
    this.code = code;
  }
}

const tones: Readonly<Record<StatePresentationKey, PresentationTone>> = Object.freeze({
  'state-info': 'info',
  'state-positive': 'positive',
  'state-warning': 'warning',
  'state-danger': 'danger',
  'state-neutral': 'neutral',
  'state-positive-neutral-context': 'positive',
  'state-inactive': 'inactive',
  'state-info-outline': 'info',
  'state-neutral-outline': 'neutral',
  'state-neutral-content': 'neutral',
  'state-warning-field': 'warning',
  'state-neutral-result': 'neutral',
  'state-info-table': 'info',
});

function fillMode(key: StatePresentationKey, surface: StatePresentationSurface): StateFillMode {
  if (surface === 'summary-line') return 'transparent';
  if (key === 'state-inactive' || key === 'state-info-outline' || key === 'state-neutral-outline' || key === 'state-neutral-content' || key === 'state-info-table') return 'outline';
  return 'soft';
}

function borderToken(key: StatePresentationKey, surface: StatePresentationSurface, tone: PresentationTone) {
  if (surface === 'summary-line' || key === 'state-neutral-content') return 'transparent' as const;
  return resolvePresentationBorderToken(tone);
}

function presentation(key: StatePresentationKey, surface: StatePresentationSurface): StatePresentation {
  const tone = tones[key];
  const mode = fillMode(key, surface);
  const mixedPositiveNeutral = key === 'state-positive-neutral-context';
  const backgroundTone = mixedPositiveNeutral ? 'neutral' : tone;
  return Object.freeze({
    key,
    surface,
    tone,
    fillMode: mode,
    tokens: Object.freeze({
      background: resolvePresentationFillToken(mode, backgroundTone),
      border: borderToken(key, surface, tone),
      text: resolvePresentationTextToken(tone),
      marker: resolvePresentationBorderToken(tone),
    }),
    preserveToneWhenDisabled: true,
  });
}

function pairId(key: StatePresentationKey, surface: StatePresentationSurface): string {
  return `${key}:${surface}`;
}

function validate(entries: readonly StatePresentation[]): readonly StatePresentation[] {
  if (entries.length !== STATE_PRESENTATION_KEYS.length * STATE_PRESENTATION_SURFACES.length) {
    throw new StateRegistryError('MISSING_STATE_PRESENTATION');
  }
  const found = new Set<string>();
  for (const entry of entries) {
    if (!STATE_PRESENTATION_KEYS.includes(entry.key) || !STATE_PRESENTATION_SURFACES.includes(entry.surface)) {
      throw new StateRegistryError('INVALID_STATE_REGISTRY_ENTRY');
    }
    const id = pairId(entry.key, entry.surface);
    if (found.has(id)) throw new StateRegistryError('DUPLICATE_STATE_PRESENTATION');
    found.add(id);
    if (entry.tone !== tones[entry.key]) throw new StateRegistryError('STATE_TONE_MISMATCH');
    if (entry.fillMode !== fillMode(entry.key, entry.surface)) throw new StateRegistryError('STATE_SURFACE_MISMATCH');
    const background = resolvePresentationFillToken(
      entry.fillMode,
      entry.key === 'state-positive-neutral-context' ? 'neutral' : entry.tone,
    );
    const border = borderToken(entry.key, entry.surface, entry.tone);
    if (entry.tokens.background !== background || entry.tokens.border !== border || entry.tokens.text !== resolvePresentationTextToken(entry.tone) || entry.tokens.marker !== resolvePresentationBorderToken(entry.tone)) {
      throw new StateRegistryError('STATE_TOKEN_MISMATCH');
    }
    if (entry.preserveToneWhenDisabled !== true) throw new StateRegistryError('INVALID_STATE_DISABLED_POLICY');
    if (!Object.isFrozen(entry) || !Object.isFrozen(entry.tokens)) throw new StateRegistryError('INVALID_STATE_REGISTRY_ENTRY');
  }
  for (const key of STATE_PRESENTATION_KEYS) for (const surface of STATE_PRESENTATION_SURFACES) {
    if (!found.has(pairId(key, surface))) throw new StateRegistryError('MISSING_STATE_PRESENTATION');
  }
  return Object.freeze([...entries]);
}

export const STATE_PRESENTATION_ENTRIES = validate(
  STATE_PRESENTATION_KEYS.flatMap((key) => STATE_PRESENTATION_SURFACES.map((surface) => presentation(key, surface))),
);

export function supportedStateSurfaces(_key: StatePresentationKey): readonly StatePresentationSurface[] {
  return STATE_PRESENTATION_SURFACES;
}
