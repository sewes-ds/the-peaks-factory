import type { PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { ManagerSalaryCorrectionContextResponse } from '../contracts';
import type { Section03NodeId } from '../program';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  type Section03ScreenProjection,
} from '../presentation';
import {
  actionButton,
  backButton,
  factory,
  interaction,
  message,
  nodeData,
  primary,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P4A1_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-C00',
  'S03-CF01',
  'S03-CF10',
  'S03-CF11',
] as const satisfies readonly Section03NodeId[]);

export type Section03P4A1SpecializedNodeId =
  typeof SECTION03_P4A1_SPECIALIZED_NODE_IDS[number];

export class Section03P4A1ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P4A1ProjectionError';
  }
}

function menuButton(
  input: P1NodeInput<'S03-C00' | 'S03-CF01'>,
  index: 0 | 1,
  id: string,
  label: string,
): PresentationGraphBridgeItemInput {
  return actionButton({
    id,
     label,
    ariaLabel: label,
    action: factory(input).presentation(`navigate${index}`, {
      instanceId: id,
      ariaLabel: label,
    }, {}),
  });
}

function projectCorrectionsMenu(
  input: P1NodeInput<'S03-C00' | 'S03-CF01'>,
): Section03ScreenProjection {
  const root = input.nodeId === 'S03-C00';
  const first = menuButton(
    input,
    0,
    root ? 'corrections-finance' : 'financial-correction-employee',
    root ? 'Финансы' : 'Корректировка по сотруднику',
  );
  const second = menuButton(
    input,
    1,
    root ? 'corrections-production' : 'financial-correction-storno',
    root ? 'Производство' : 'Сторно по операции',
  );
  const back = backButton(
    input,
    'navigateBack0',
    {},
    root ? 'corrections-back' : 'financial-correction-back',
  );
  const title = root ? 'Корректировки' : 'Финансовая корректировка';
  return defineSection03ScreenProjection({
    nodeId: input.nodeId,
    ariaLabel: title,
    fixedTopTitle: title,
    bridgeProjection: { nodeId: input.nodeId, items: [first, second, back] },
    slots: { fixedTop: [], scroll: [first.id, second.id], fixedBottom: [back.id] },
  });
}

function contextModel(
  input: P1NodeInput<'S03-CF10' | 'S03-CF11'>,
): ManagerSalaryCorrectionContextResponse {
  return primary(input) as unknown as ManagerSalaryCorrectionContextResponse;
}

function employeeRow(
  input: P1NodeInput<'S03-CF10'>,
  employee: ManagerSalaryCorrectionContextResponse['employees_with_today_shift'][number],
): PresentationGraphBridgeItemInput {
  const id = `cf-emp-${employee.employee_id}`;
  return Object.freeze({
    kind: 'state-list-button' as const,
    id,
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticInfoList, null),
    interaction: interaction(factory(input).presentation('navigate0', {
      instanceId: id,
      ariaLabel: employee.employee_full_name,
    }, {
      employee_id: employee.employee_id,
      employee_shift_id: employee.employee_shift_id,
    })),
    mainLine: text(employee.employee_full_name),
    ariaLabel: employee.employee_full_name,
  });
}

function projectEmployeeSelection(
  input: P1NodeInput<'S03-CF10'>,
): Section03ScreenProjection {
  const response = contextModel(input);
  const rows: PresentationGraphBridgeItemInput[] = response.employees_with_today_shift.map(
    (employee) => employeeRow(input, employee),
  );
  if (rows.length === 0) {
    rows.push(message(
      'financial-correction-employee-empty',
      'Нет сотрудников со сменой за текущий день.',
      SECTION03_POLICY_ROOTS.staticInfoMessage,
    ));
  }
  const back = backButton(input, 'navigateBack0', {}, 'financial-correction-employee-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF10',
    ariaLabel: 'Финансовая корректировка',
    fixedTopTitle: 'Финансовая корректировка',
    bridgeProjection: { nodeId: 'S03-CF10', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((row) => row.id), fixedBottom: [back.id] },
  });
}

function projectModeSelection(
  input: P1NodeInput<'S03-CF11'>,
): Section03ScreenProjection {
  const response = contextModel(input);
  const context = nodeData(input).context;
  const employeeId = context.employee_id;
  const shiftId = context.employee_shift_id;
  if (employeeId === undefined || shiftId === undefined) {
    throw new Section03P4A1ProjectionError('CF11 requires employee_id and employee_shift_id.');
  }
  const selected = response.employees_with_today_shift.find(
    (employee) => employee.employee_id === employeeId,
  );
  if (selected === undefined) {
    throw new Section03P4A1ProjectionError(`Selected correction employee ${employeeId} is missing.`);
  }
  if (selected.employee_shift_id !== shiftId) {
    throw new Section03P4A1ProjectionError(`Selected correction employee ${employeeId} shift does not match.`);
  }
  const identity = Object.freeze({ employee_id: employeeId, employee_shift_id: shiftId });
  const employee = message(
    'financial-correction-selected-employee',
    selected.employee_full_name,
    SECTION03_POLICY_ROOTS.staticInfoMessage,
  );
  const accrualEvent = Object.freeze({
    ...identity,
    correction_mode: 'accrual' as const,
    salary_correction_type_id: response.default_accrual_salary_correction_type_id,
  });
  const withholdingEvent = Object.freeze({
    ...identity,
    correction_mode: 'withholding' as const,
    salary_correction_type_id: response.default_withholding_salary_correction_type_id,
  });
  const accrual = actionButton({
    id: 'financial-correction-accrual',
     label: 'Начислить',
    ariaLabel: 'Начислить',
    action: factory(input).presentation('navigate0', {
      instanceId: 'financial-correction-accrual', ariaLabel: 'Начислить',
    }, accrualEvent),
  });
  const withholding = actionButton({
    id: 'financial-correction-withholding',
     label: 'Удержать',
    ariaLabel: 'Удержать',
    action: factory(input).presentation('navigate0', {
      instanceId: 'financial-correction-withholding', ariaLabel: 'Удержать',
    }, withholdingEvent),
  });
  const back = backButton(input, 'navigateBack0', identity, 'financial-correction-mode-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF11',
    ariaLabel: 'Финансовая корректировка',
    fixedTopTitle: 'Финансовая корректировка',
    bridgeProjection: { nodeId: 'S03-CF11', items: [employee, accrual, withholding, back] },
    slots: { fixedTop: [], scroll: [employee.id, accrual.id, withholding.id], fixedBottom: [back.id] },
  });
}

export function projectSection03P4A1(
  input: P1NodeInput<Section03P4A1SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-C00':
    case 'S03-CF01': return projectCorrectionsMenu(input as P1NodeInput<'S03-C00' | 'S03-CF01'>);
    case 'S03-CF10': return projectEmployeeSelection(input as P1NodeInput<'S03-CF10'>);
    case 'S03-CF11': return projectModeSelection(input as P1NodeInput<'S03-CF11'>);
  }
}
