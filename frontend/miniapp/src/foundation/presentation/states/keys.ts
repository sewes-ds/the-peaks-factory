export const STATE_PRESENTATION_KEYS = Object.freeze([
  'state-info',
  'state-positive',
  'state-warning',
  'state-danger',
  'state-neutral',
  'state-positive-neutral-context',
  'state-inactive',
  'state-info-outline',
  'state-neutral-outline',
  'state-neutral-content',
  'state-warning-field',
  'state-neutral-result',
  'state-info-table',
] as const);

export type StatePresentationKey = typeof STATE_PRESENTATION_KEYS[number];

export const STATE_PRESENTATION_SURFACES = Object.freeze([
  'list-button',
  'entity-row',
  'card',
  'summary-line',
  'message',
] as const);

export type StatePresentationSurface = typeof STATE_PRESENTATION_SURFACES[number];
