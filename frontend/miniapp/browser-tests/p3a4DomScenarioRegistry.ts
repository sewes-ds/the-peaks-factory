export const SECTION03_P3A4_DOM_SCENARIOS = Object.freeze([
  'additional-work-accrual-happy-path',
  'additional-work-no-accrual-happy-path',
  'additional-work-accrual-back-errors',
] as const);

export type Section03P3A4DomScenarioId =
  typeof SECTION03_P3A4_DOM_SCENARIOS[number];
