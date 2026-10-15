import { formatDisplayInteger, type PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerEmployeeSalaryHistoryMonth,
  ManagerEmployeeSalaryHistoryResponse,
  ManagerEmployeeSalaryResponse,
} from '../contracts';
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
  context,
  factory,
  interaction,
  message,
  primary,
  text,
  type P1NodeInput,
} from './common';
import { formatSection03SalaryMonth } from '../presentation/salaryMonth';

export const SECTION03_P2B2_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-SAL01',
  'S03-SAL02',
] as const satisfies readonly Section03NodeId[]);

export type Section03P2B2SpecializedNodeId =
  typeof SECTION03_P2B2_SPECIALIZED_NODE_IDS[number];

export class Section03P2B2IdentityError extends Error {
  readonly field: string;
  readonly expected: string;
  readonly actual: string;

  constructor(field: string, expected: string, actual: string) {
    super(`Invalid employee salary identity at ${field}: expected ${expected}.`);
    this.name = 'Section03P2B2IdentityError';
    this.field = field;
    this.expected = expected;
    this.actual = actual;
    Object.freeze(this);
  }
}

function requiredEmployeeId(input: P1NodeInput): string {
  const employeeId = context(input).employee_id;
  if (employeeId === undefined) throw new Error('Missing salary context employee_id.');
  return employeeId;
}

function validateIdentity(
  model: Readonly<{
    employee_id: string;
    employee: Readonly<{ employee_id: string }>;
  }>,
  employeeId: string,
): void {
  if (model.employee_id !== model.employee.employee_id) {
    throw new Section03P2B2IdentityError(
      '$.employee_id', model.employee.employee_id, model.employee_id,
    );
  }
  if (model.employee.employee_id !== employeeId) {
    throw new Section03P2B2IdentityError(
      '$.employee.employee_id', employeeId, model.employee.employee_id,
    );
  }
}

function labeled(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function navigationControl(input: Readonly<{
  id: string;
  label: string;
  action: object;
}>): PresentationGraphBridgeItemInput {
  return actionButton({
    id: input.id,
     action: input.action,
    label: input.label,
    ariaLabel: input.label,
  });
}

function summaryModel(
  input: P1NodeInput<'S03-SAL01'>,
): ManagerEmployeeSalaryResponse {
  return primary(input) as unknown as ManagerEmployeeSalaryResponse;
}

function projectSalarySummary(
  input: P1NodeInput<'S03-SAL01'>,
): Section03ScreenProjection {
  const employeeId = requiredEmployeeId(input);
  const model = summaryModel(input);
  validateIdentity(model, employeeId);
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'salary-summary-card',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticInfoCard, null),
    lines: Object.freeze([
      labeled('salary-employee', 'Сотрудник', model.employee.full_name),
      labeled('salary-today', 'Сегодня', `${formatDisplayInteger(model.totals.today_uzs)} сум`),
      labeled('salary-week', 'Неделя', `${formatDisplayInteger(model.totals.week_uzs)} сум`),
      labeled('salary-month', 'Месяц', `${formatDisplayInteger(model.totals.month_uzs)} сум`),
    ]),
    ariaLabel: 'Итоги зарплаты',
  });
  const history = navigationControl({
    id: 'salary-history',
    label: 'История зарплаты',
    action: factory(input).presentation(
      'navigate0',
      { instanceId: 'salary-history', ariaLabel: 'История зарплаты' },
      { employee_id: employeeId },
    ),
  });
  const back = backButton(
    input,
    'navigateBack0',
    { employee_id: employeeId },
    'salary-summary-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-SAL01',
    ariaLabel: 'Зарплата',
    fixedTopTitle: 'Зарплата',
    bridgeProjection: { nodeId: 'S03-SAL01', items: [card, history, back] },
    slots: {
      fixedTop: [],
      scroll: [card.id],
      fixedBottom: [history.id, back.id],
    },
  });
}

function historyModel(
  input: P1NodeInput<'S03-SAL02'>,
): ManagerEmployeeSalaryHistoryResponse {
  return primary(input) as unknown as ManagerEmployeeSalaryHistoryResponse;
}

function monthLines(
  month: ManagerEmployeeSalaryHistoryMonth,
  index: number,
): readonly PresentationGraphCardLineInput[] {
  const formattedMonth = formatSection03SalaryMonth(month.month);
  return Object.freeze([
    Object.freeze({ id: `salary-month-${index}-name`, content: text(formattedMonth) }),
    labeled(`salary-month-${index}-production`, 'Производство', `${formatDisplayInteger(month.production_uzs)} сум`),
    labeled(`salary-month-${index}-additional`, 'Доп.Работы', `${formatDisplayInteger(month.additional_work_uzs)} сум`),
    ...(month.corrections_uzs === null
      ? []
      : [labeled(`salary-month-${index}-corrections`, 'Корректировки', `${formatDisplayInteger(month.corrections_uzs)} сум`)]),
    ...(month.reversals_uzs === null
      ? []
      : [labeled(`salary-month-${index}-reversals`, 'Сторно', `${formatDisplayInteger(month.reversals_uzs)} сум`)]),
    labeled(`salary-month-${index}-total`, 'Всего', `${formatDisplayInteger(month.total_uzs)} сум`),
  ]);
}

function projectSalaryHistory(
  input: P1NodeInput<'S03-SAL02'>,
): Section03ScreenProjection {
  const employeeId = requiredEmployeeId(input);
  const model = historyModel(input);
  validateIdentity(model, employeeId);
  const cards: PresentationGraphBridgeItemInput[] = model.months.map((month, index) => {
    const formattedMonth = formatSection03SalaryMonth(month.month);
    return Object.freeze({
      kind: 'card' as const,
      id: `salary-history-month-${index}`,
      presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticInfoCard, null),
      lines: monthLines(month, index),
      ariaLabel: `Месяц зарплаты ${formattedMonth}`,
    });
  });
  if (cards.length === 0) {
    cards.push(message('salary-history-empty', 'История зарплаты отсутствует.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  }
  const back = backButton(
    input,
    'navigateBack0',
    { employee_id: employeeId },
    'salary-history-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-SAL02',
    ariaLabel: 'История зарплаты',
    fixedTopTitle: 'История зарплаты',
    bridgeProjection: { nodeId: 'S03-SAL02', items: [...cards, back] },
    slots: {
      fixedTop: [],
      scroll: cards.map((item) => item.id),
      fixedBottom: [back.id],
    },
  });
}

export function projectSection03P2B2(
  input: P1NodeInput<Section03P2B2SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-SAL01':
      return projectSalarySummary(input as P1NodeInput<'S03-SAL01'>);
    case 'S03-SAL02':
      return projectSalaryHistory(input as P1NodeInput<'S03-SAL02'>);
  }
}
