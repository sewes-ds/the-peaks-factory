import type { Section03Context } from '../program/context';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import type { Section03NodeId } from '../program/ids';

export const SECTION03_FIXTURE_NODE_IDS = Object.freeze([
  'S03-N01', 'S03-M01', 'S03-M02', 'S03-M03O', 'S03-M03C', 'S03-M04C',
  'S03-D01', 'S03-D10', 'S03-D11', 'S03-D12', 'S03-D13',
  'S03-E01', 'S03-E02', 'S03-E10', 'S03-E11', 'S03-E12', 'S03-E13', 'S03-E14', 'S03-E16', 'S03-E17', 'S03-E20', 'S03-E21', 'S03-E22',
  'S03-AW01', 'S03-AW10', 'S03-AW11', 'S03-AW12', 'S03-AW20', 'S03-AW21', 'S03-AW30', 'S03-AW31', 'S03-AW40', 'S03-AW41', 'S03-AW42', 'S03-AW50', 'S03-AW51', 'S03-AW52', 'S03-AW53', 'S03-AW54',
  'S03-SAL01', 'S03-SAL02',
  'S03-C00', 'S03-CF01', 'S03-CF10', 'S03-CF11', 'S03-CF12', 'S03-CF13', 'S03-CF14', 'S03-CF20', 'S03-CF21', 'S03-CF22', 'S03-CF23', 'S03-CF24', 'S03-CF25', 'S03-CP00', 'S03-CP10', 'S03-CP11', 'S03-CP12', 'S03-CP13', 'S03-CP14', 'S03-CP15', 'S03-CP16', 'S03-CP20',
  'S03-NOT01',
  'S03-R01', 'S03-R10', 'S03-R11', 'S03-R12', 'S03-R13', 'S03-R14',
] as const satisfies readonly Section03NodeId[]);

const scalarFixtures: Readonly<Record<string, string | number>> = Object.freeze({
  employee_id: 'EMP-1', employee_full_name: 'Иванов Иван Иванович', machine_id: 'M-1', downtime_id: 'D-1',
  production_operation_id: 'PO-1', downtime_type_id: 'DT-1', downtime_type_name: 'Критический простой', additional_work_id: 'AW-1', additional_work_type_id: 'AWT-1', additional_work_type_name: 'Инвентаризация',
  work_type: 'production', operation_id: 'OP-1', salary_entry_id: 'SE-1', employee_shift_id: 'SHIFT-1',
  salary_correction_type_id: 'SCT-1', correction_mode: 'accrual', production_correction_mode: 'final', period: 'today',
  from_date: '2026-07-01', to_date: '2026-07-31', comment_finish: 'Подтверждённый комментарий завершения',
  comment_start: 'Подтверждённая причина критического простоя', quantity_produced: '12.5',
  shift_finish_reason: 'Смена завершена по подтверждённой причине', amount_uzs: '125000',
  without_accrual_reason: 'Работа учтена без начисления', financial_correction_reason: 'Подтверждённая корректировка',
  reversal_reason: 'Подтверждённая причина сторно', correction_quantity: '15',
  production_correction_reason: 'Подтверждённая производственная корректировка', export_run_id: 'EXPORT-1', refresh_nonce: 1,
});

function contextFor(nodeId: Section03NodeId): Section03Context {
  const output: Record<string, string | number> = {};
  for (const field of SECTION03_NODE_REGISTRY[nodeId].requiredContext) {
    const value = scalarFixtures[field];
    if (value !== undefined) output[field] = value;
  }
  if (['S03-CP11', 'S03-CP12', 'S03-CP13', 'S03-CP14', 'S03-CP15', 'S03-CP16'].includes(nodeId)) {
    output.correction_scope = 'employee';
    output.employee_id = 'EMP-1';
  }
  if (nodeId === ['S03', 'R13'].join('-')) output.period = 'today';
  return Object.freeze(output) as Section03Context;
}

export type Section03Fixture = Readonly<{
  nodeId: Section03NodeId;
  fixtureId: string;
  context: Section03Context;
  variants: readonly ('representative' | 'empty' | 'long-content' | 'multiline')[];
  expectedProjectionSummary: string;
  expectedActionIds: readonly string[];
}>;

export const SECTION03_FIXTURES = Object.freeze(Object.fromEntries(
  SECTION03_FIXTURE_NODE_IDS.map((nodeId) => [nodeId, Object.freeze({
    nodeId,
    fixtureId: `${nodeId}:representative`,
    context: contextFor(nodeId),
    variants: Object.freeze(['representative', 'empty', 'long-content', 'multiline'] as const),
    expectedProjectionSummary: `${SECTION03_NODE_REGISTRY[nodeId].family}:${SECTION03_NODE_REGISTRY[nodeId].projection}`,
    expectedActionIds: Object.freeze([]),
  })]),
)) as unknown as Readonly<Record<Section03NodeId, Section03Fixture>>;
