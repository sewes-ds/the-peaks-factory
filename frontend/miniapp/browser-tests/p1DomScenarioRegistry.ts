export const SECTION03_P1_DOM_SCENARIOS = Object.freeze([
  'main-machines-back',
  'main-downtimes-open-card-back',
  'operational-finish-from-machines',
  'critical-finish-from-machines',
  'start-from-machine-card',
  'start-from-downtime-section',
  'operational-conflict-during-machine-selection',
  'p1-back-matrix',
] as const);

export type Section03P1DomScenarioId = typeof SECTION03_P1_DOM_SCENARIOS[number];
