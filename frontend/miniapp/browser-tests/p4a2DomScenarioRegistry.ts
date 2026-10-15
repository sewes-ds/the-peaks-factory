export const SECTION03_P4A2_DOM_SCENARIOS = Object.freeze([
  'financial-correction-accrual-success',
  'financial-correction-withholding-back-pending',
  'financial-correction-failures-authority',
] as const);

export type Section03P4A2DomScenarioId =
  typeof SECTION03_P4A2_DOM_SCENARIOS[number];
