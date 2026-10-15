export const PRESENTATION_INTENTS = Object.freeze([
  'navigation',
  'selection',
  'positive',
  'warning',
  'danger',
  'neutral',
  'cancel',
  'reject',
  'reversal',
] as const);

export const PRESENTATION_TONES = Object.freeze([
  'info',
  'positive',
  'warning',
  'danger',
  'neutral',
  'inactive',
] as const);

export const PRESENTATION_SURFACES = Object.freeze([
  'action-button',
  'list-button',
  'entity-row',
  'card',
  'summary-line',
  'message',
] as const);

export const PRESENTATION_EMPHASES = Object.freeze([
  'primary',
  'secondary',
  'tertiary',
] as const);

export const PRESENTATION_AVAILABILITIES = Object.freeze([
  'enabled',
  'disabled',
  'inert',
  'pending',
] as const);

export const PRESENTATION_FILL_MODES = Object.freeze([
  'solid',
  'soft',
  'outline',
  'transparent',
] as const);

export const PRESENTATION_TEXT_TONES = Object.freeze([
  'info',
  'positive',
  'warning',
  'danger',
  'neutral',
  'inactive',
  'inverse',
  'muted',
] as const);

export type PresentationIntent = typeof PRESENTATION_INTENTS[number];
export type PresentationTone = typeof PRESENTATION_TONES[number];
export type PresentationSurface = typeof PRESENTATION_SURFACES[number];
export type PresentationEmphasis = typeof PRESENTATION_EMPHASES[number];
export type PresentationAvailability = typeof PRESENTATION_AVAILABILITIES[number];
export type PresentationFillMode = typeof PRESENTATION_FILL_MODES[number];
export type PresentationTextTone = typeof PRESENTATION_TEXT_TONES[number];
