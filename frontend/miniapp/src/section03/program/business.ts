import type { Section03NodeId } from './ids';

export type Section03BusinessActionId =
  | 'FINISH_DOWNTIME'
  | 'START_CRITICAL_DOWNTIME'
  | 'CLOSE_EMPLOYEE_SHIFT'
  | 'FINISH_PRODUCTION_BLOCKER'
  | 'FINISH_BREAK_BLOCKER'
  | 'FINISH_ADDITIONAL_WORK'
  | 'APPROVE_ADDITIONAL_WORK'
  | 'REJECT_ADDITIONAL_WORK'
  | 'CANCEL_ADDITIONAL_WORK'
  | 'ASSIGN_ADDITIONAL_WORK'
  | 'ACCRUE_ADDITIONAL_WORK'
  | 'MARK_WITHOUT_ACCRUAL'
  | 'CREATE_APPROVE_SALARY_CORRECTION'
  | 'REVERSE_SALARY_ENTRY'
  | 'CREATE_PRODUCTION_CORRECTION'
  | 'CREATE_GOOGLE_SHEETS_EXPORT';

export type Section03BusinessActionDefinition = Readonly<{
  actionId: Section03BusinessActionId;
  nodes: readonly Section03NodeId[];
  method: 'POST';
  path: string;
  authority: string;
  success: string;
  freshRead: boolean;
}>;

function action(definition: Section03BusinessActionDefinition): Section03BusinessActionDefinition {
  return Object.freeze({ ...definition, nodes: Object.freeze([...definition.nodes]) });
}

export const SECTION03_BUSINESS_ACTIONS = Object.freeze([
  action({ actionId: 'FINISH_DOWNTIME', nodes: ['S03-M03O', 'S03-M04C'], method: 'POST', path: '/machine-downtimes/:downtime_id/finish', authority: 'machine.available_actions:FINISH_DOWNTIME', success: 'critical-start follow-up -> S03-D12; otherwise S03-M01', freshRead: true }),
  action({ actionId: 'START_CRITICAL_DOWNTIME', nodes: ['S03-D13'], method: 'POST', path: '/machine-downtimes/start', authority: 'machine/workplace available_actions:START_CRITICAL_DOWNTIME', success: 'S03-N01', freshRead: true }),
  action({ actionId: 'CLOSE_EMPLOYEE_SHIFT', nodes: ['S03-E11'], method: 'POST', path: '/shifts/:employee_id/emergency-close', authority: 'employee.available_actions:FINISH_EMPLOYEE_SHIFT_BY_MANAGER', success: 'S03-E01', freshRead: true }),
  action({ actionId: 'FINISH_PRODUCTION_BLOCKER', nodes: ['S03-E14'], method: 'POST', path: '/production-operations/:production_operation_id/finish', authority: 'employee.blockers.production non-null with matching production_operation_id', success: 'fresh blockers -> S03-E12 or S03-E10', freshRead: true }),
  action({ actionId: 'FINISH_BREAK_BLOCKER', nodes: ['S03-E16'], method: 'POST', path: '/operator-breaks/:employee_id/emergency-finish', authority: 'employee.blockers.break non-null', success: 'fresh blockers -> S03-E12 or S03-E10', freshRead: true }),
  action({ actionId: 'FINISH_ADDITIONAL_WORK', nodes: ['S03-E17', 'S03-AW31'], method: 'POST', path: '/additional-works/:additional_work_id/finish', authority: 'S03-E17 exact employee blocker with matching additional_work_id, or S03-AW31 exact selected typed active item with matching additional_work_id and selected-item available_actions:FINISH_ADDITIONAL_WORK; unrelated records provide no authority', success: 'E17 fresh blockers -> S03-E12 or S03-E10; AW31 -> S03-AW01', freshRead: true }),
  action({ actionId: 'APPROVE_ADDITIONAL_WORK', nodes: ['S03-AW11'], method: 'POST', path: '/additional-works/:additional_work_id/approve-request', authority: 'exact selected typed item with matching additional_work_id, requested status and selected-item available_actions:APPROVE_ADDITIONAL_WORK_REQUEST; unrelated records provide no authority', success: 'S03-AW01', freshRead: true }),
  action({ actionId: 'REJECT_ADDITIONAL_WORK', nodes: ['S03-AW12'], method: 'POST', path: '/additional-works/:additional_work_id/reject-request', authority: 'exact selected typed item with matching additional_work_id, requested status and selected-item available_actions:REJECT_ADDITIONAL_WORK_REQUEST; unrelated records provide no authority', success: 'S03-AW01', freshRead: true }),
  action({ actionId: 'CANCEL_ADDITIONAL_WORK', nodes: ['S03-AW21'], method: 'POST', path: '/additional-works/:additional_work_id/cancel', authority: 'exact selected typed item with matching additional_work_id, approved status and selected-item available_actions:CANCEL_ADDITIONAL_WORK; unrelated records provide no authority', success: 'S03-AW01', freshRead: true }),
  action({ actionId: 'ASSIGN_ADDITIONAL_WORK', nodes: ['S03-AW42'], method: 'POST', path: '/additional-works/assign', authority: 'exact selected employee/type assignability item can_assign=true and top-level available_actions:ASSIGN_ADDITIONAL_WORK; employee/type IDs and display scalars required by context', success: 'S03-AW01', freshRead: true }),
  action({ actionId: 'ACCRUE_ADDITIONAL_WORK', nodes: ['S03-AW52'], method: 'POST', path: '/additional-works/:additional_work_id/accrue-salary', authority: 'exact selected typed item with matching additional_work_id, waiting_accrual status, selected-item available_actions:ACCRUE_ADDITIONAL_WORK_SALARY and positive normalized amount_uzs context; unrelated records provide no authority', success: 'S03-AW01', freshRead: true }),
  action({ actionId: 'MARK_WITHOUT_ACCRUAL', nodes: ['S03-AW54'], method: 'POST', path: '/additional-works/:additional_work_id/mark-without-accrual', authority: 'exact selected typed item with matching additional_work_id, waiting_accrual status, selected-item available_actions:MARK_WITHOUT_ACCRUAL and non-empty trimmed without_accrual_reason context; unrelated records provide no authority', success: 'S03-AW01', freshRead: true }),
  action({ actionId: 'CREATE_APPROVE_SALARY_CORRECTION', nodes: ['S03-CF14'], method: 'POST', path: '/salary-corrections/apply', authority: 'workplace available_actions:OPEN_CORRECTIONS plus decoded correction context', success: 'S03-C00', freshRead: true }),
  action({ actionId: 'REVERSE_SALARY_ENTRY', nodes: ['S03-CF25'], method: 'POST', path: '/salary-entries/:salary_entry_id/reverse', authority: 'workplace available_actions:OPEN_CORRECTIONS plus decoded salary entry', success: 'S03-C00', freshRead: true }),
  action({ actionId: 'CREATE_PRODUCTION_CORRECTION', nodes: ['S03-CP16'], method: 'POST', path: '/production-operation-corrections/apply', authority: 'workplace available_actions:OPEN_CORRECTIONS plus decoded production operation', success: 'S03-C00', freshRead: true }),
  action({ actionId: 'CREATE_GOOGLE_SHEETS_EXPORT', nodes: ['S03-R13'], method: 'POST', path: '/exports/google-sheets', authority: 'workplace available_actions:OPEN_REPORTS', success: 'S03-R14', freshRead: true }),
] as const);
