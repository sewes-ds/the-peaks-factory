export const CONTROL_SEMANTIC_KEYS = Object.freeze([
  'navigation-back',
  'navigation-next',
  'navigation-open',
  'selection-primary',
  'selection-secondary',
  'action-positive',
  'action-positive-neutral-context',
  'action-warning',
  'action-danger',
  'action-neutral',
  'action-cancel',
  'action-reject',
  'action-reversal',
] as const);

export type ControlSemanticKey = typeof CONTROL_SEMANTIC_KEYS[number];

export const CONTROL_SURFACES = Object.freeze([
  'action-button',
  'list-button',
] as const);

export type ControlSurface = typeof CONTROL_SURFACES[number];
