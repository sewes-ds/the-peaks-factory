import type { Section03BusinessActionId } from '../src/section03/program/business';
import type { Section03NodeId } from '../src/section03/program';

export const SECTION03_BROWSER_SCENARIOS = Object.freeze([
  'machines-operational-finish', 'machines-critical-finish', 'machines-start-critical-downtime',
  'downtime-section-start', 'employee-blockers-shift-close', 'employee-completed-works', 'employee-salary',
  'additional-work-approve', 'additional-work-reject', 'additional-work-cancel', 'additional-work-finish',
  'additional-work-assign', 'additional-work-accrue', 'additional-work-without-accrual',
  'financial-correction-create-approve', 'salary-entry-reversal',
  'production-correction-employee', 'production-correction-machine', 'notifications',
] as const);

export type Section03BrowserScenarioId = typeof SECTION03_BROWSER_SCENARIOS[number];

export type Section03BrowserScenarioStep =
  | Readonly<{ kind: 'navigate'; nodeId: Section03NodeId }>
  | Readonly<{ kind: 'business'; actionId: Section03BusinessActionId; successNodeId: Section03NodeId }>;

const navigate = (nodeId: Section03NodeId): Section03BrowserScenarioStep => Object.freeze({ kind: 'navigate', nodeId });
const business = (actionId: Section03BusinessActionId, successNodeId: Section03NodeId): Section03BrowserScenarioStep => Object.freeze({ kind: 'business', actionId, successNodeId });
const scenario = (
  steps: readonly Section03BrowserScenarioStep[],
  mutationPaths: readonly string[] = [],
) => Object.freeze({ steps: Object.freeze(steps), mutationPaths: Object.freeze(mutationPaths) });

export const SECTION03_BROWSER_SCENARIO_REGISTRY = Object.freeze({
  'machines-operational-finish': scenario([navigate('S03-N01'), navigate('S03-M01'), navigate('S03-M02'), navigate('S03-M03O'), business('FINISH_DOWNTIME', 'S03-M01')], ['/machine-downtimes/D-1/finish']),
  'machines-critical-finish': scenario([navigate('S03-N01'), navigate('S03-M01'), navigate('S03-M02'), navigate('S03-M03C'), navigate('S03-M04C'), business('FINISH_DOWNTIME', 'S03-M01')], ['/machine-downtimes/D-1/finish']),
  'machines-start-critical-downtime': scenario([navigate('S03-N01'), navigate('S03-M01'), navigate('S03-M02'), navigate('S03-D10'), navigate('S03-D12'), navigate('S03-D13'), business('START_CRITICAL_DOWNTIME', 'S03-N01')], ['/machine-downtimes/start']),
  'downtime-section-start': scenario([navigate('S03-N01'), navigate('S03-D01'), navigate('S03-D10'), navigate('S03-D11'), navigate('S03-D12'), navigate('S03-D13'), business('START_CRITICAL_DOWNTIME', 'S03-N01')], ['/machine-downtimes/start']),
  'employee-blockers-shift-close': scenario([navigate('S03-N01'), navigate('S03-E01'), navigate('S03-E02'), navigate('S03-E12'), navigate('S03-E13'), navigate('S03-E14'), business('FINISH_PRODUCTION_BLOCKER', 'S03-E12'), navigate('S03-E16'), business('FINISH_BREAK_BLOCKER', 'S03-E12'), navigate('S03-E17'), business('FINISH_ADDITIONAL_WORK', 'S03-E12'), navigate('S03-E10'), navigate('S03-E11'), business('CLOSE_EMPLOYEE_SHIFT', 'S03-E01')], ['/production-operations/PO-1/finish', '/operator-breaks/EMP-1/emergency-finish', '/additional-works/AW-1/finish', '/shifts/EMP-1/emergency-close']),
  'employee-completed-works': scenario([navigate('S03-N01'), navigate('S03-E01'), navigate('S03-E02'), navigate('S03-E20'), navigate('S03-E21'), navigate('S03-E22')]),
  'employee-salary': scenario([navigate('S03-N01'), navigate('S03-E01'), navigate('S03-E02'), navigate('S03-SAL01'), navigate('S03-SAL02')]),
  'additional-work-approve': scenario([navigate('S03-N01'), navigate('S03-AW01'), navigate('S03-AW10'), navigate('S03-AW11'), business('APPROVE_ADDITIONAL_WORK', 'S03-AW01')], ['/additional-works/REQ-1/approve-request']),
  'additional-work-reject': scenario([navigate('S03-N01'), navigate('S03-AW01'), navigate('S03-AW10'), navigate('S03-AW12'), business('REJECT_ADDITIONAL_WORK', 'S03-AW01')], ['/additional-works/REQ-1/reject-request']),
  'additional-work-cancel': scenario([navigate('S03-N01'), navigate('S03-AW01'), navigate('S03-AW20'), navigate('S03-AW21'), business('CANCEL_ADDITIONAL_WORK', 'S03-AW01')], ['/additional-works/APP-1/cancel']),
  'additional-work-finish': scenario([navigate('S03-N01'), navigate('S03-AW01'), navigate('S03-AW30'), navigate('S03-AW31'), business('FINISH_ADDITIONAL_WORK', 'S03-AW01')], ['/additional-works/ACT-1/finish']),
  'additional-work-assign': scenario([navigate('S03-N01'), navigate('S03-AW01'), navigate('S03-AW40'), navigate('S03-AW41'), navigate('S03-AW42'), business('ASSIGN_ADDITIONAL_WORK', 'S03-AW01')], ['/additional-works/assign']),
  'additional-work-accrue': scenario([navigate('S03-N01'), navigate('S03-AW01'), navigate('S03-AW50'), navigate('S03-AW51'), navigate('S03-AW52'), business('ACCRUE_ADDITIONAL_WORK', 'S03-AW01')], ['/additional-works/WAIT-1/accrue-salary']),
  'additional-work-without-accrual': scenario([navigate('S03-N01'), navigate('S03-AW01'), navigate('S03-AW50'), navigate('S03-AW53'), navigate('S03-AW54'), business('MARK_WITHOUT_ACCRUAL', 'S03-AW01')], ['/additional-works/WAIT-1/mark-without-accrual']),
  'financial-correction-create-approve': scenario([navigate('S03-N01'), navigate('S03-C00'), navigate('S03-CF01'), navigate('S03-CF10'), navigate('S03-CF11'), navigate('S03-CF12'), navigate('S03-CF13'), navigate('S03-CF14'), business('CREATE_APPROVE_SALARY_CORRECTION', 'S03-C00')], ['/salary-corrections/apply']),
  'salary-entry-reversal': scenario([navigate('S03-N01'), navigate('S03-C00'), navigate('S03-CF01'), navigate('S03-CF20'), navigate('S03-CF21'), navigate('S03-CF22'), navigate('S03-CF23'), navigate('S03-CF24'), navigate('S03-CF25'), business('REVERSE_SALARY_ENTRY', 'S03-C00')], ['/salary-entries/SAL-PROD/reverse']),
  'production-correction-employee': scenario([navigate('S03-N01'), navigate('S03-C00'), navigate('S03-CP00'), navigate('S03-CP10'), navigate('S03-CP11'), navigate('S03-CP12'), navigate('S03-CP13'), navigate('S03-CP14'), navigate('S03-CP15'), navigate('S03-CP16'), business('CREATE_PRODUCTION_CORRECTION', 'S03-C00')], ['/production-operation-corrections/apply']),
  'production-correction-machine': scenario([navigate('S03-N01'), navigate('S03-C00'), navigate('S03-CP00'), navigate('S03-CP20'), navigate('S03-CP11'), navigate('S03-CP12'), navigate('S03-CP13'), navigate('S03-CP14'), navigate('S03-CP15'), navigate('S03-CP16'), business('CREATE_PRODUCTION_CORRECTION', 'S03-C00')], ['/production-operation-corrections/apply']),
  notifications: scenario([navigate('S03-N01'), navigate('S03-NOT01')]),
} satisfies Readonly<Record<Section03BrowserScenarioId, Readonly<{
  steps: readonly Section03BrowserScenarioStep[];
  mutationPaths: readonly string[];
}>>>);
