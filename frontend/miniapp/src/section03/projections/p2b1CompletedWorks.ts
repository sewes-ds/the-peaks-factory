import type {
  PresentationGraphBridgeItemInput,
} from '../../foundation/presentation';
import { formatDisplayDate, formatDisplayInteger } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerCompletedWorkCardResponse,
  ManagerCompletedWorkItem,
  ManagerCompletedWorksResponse,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type {
  Section03Context,
  Section03Period,
  Section03WorkType,
} from '../program/context';
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

export const SECTION03_P2B1_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-E20',
  'S03-E21',
  'S03-E22',
] as const satisfies readonly Section03NodeId[]);

export type Section03P2B1SpecializedNodeId =
  typeof SECTION03_P2B1_SPECIALIZED_NODE_IDS[number];

export class Section03P2B1IdentityError extends Error {
  readonly field: string;
  readonly expected: string;
  readonly actual: string;

  constructor(field: string, expected: string, actual: string) {
    super(`Invalid completed-work identity at ${field}: expected ${expected}.`);
    this.name = 'Section03P2B1IdentityError';
    this.field = field;
    this.expected = expected;
    this.actual = actual;
    Object.freeze(this);
  }
}

function scalar(
  value: string | number | undefined,
  field: string,
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing completed-work context ${field}.`);
  }
  return value;
}

function requiredPeriod(value: Section03Period | undefined): Section03Period {
  if (value === undefined) throw new Error('Missing completed-work context period.');
  return value;
}

function requiredWorkType(value: Section03WorkType | undefined): Section03WorkType {
  if (value === undefined) throw new Error('Missing completed-work context work_type.');
  return value;
}

function actionControl(input: Readonly<{
  id: string;
  label: string;
  action: object;
  enabled?: boolean;
}>): PresentationGraphBridgeItemInput {
  return actionButton({
    id: input.id,
    action: input.action,
    label: input.label,
    ariaLabel: input.label,
    enabled: input.enabled ?? true,
  });
}

function salary(work: ManagerCompletedWorkItem): string {
  if (work.salary_amount_uzs.length > 0) return formatDisplayInteger(work.salary_amount_uzs);
  if (work.amount_uzs.length > 0) return formatDisplayInteger(work.amount_uzs);
  return formatDisplayInteger('0');
}

function quantity(work: ManagerCompletedWorkItem): string {
  const value = work.quantity ?? work.current_quantity;
  return value === null ? '—' : formatDisplayInteger(value);
}

function nonEmpty(value: string | null): string | null {
  return value !== null && value.trim().length > 0 ? value : null;
}

function workMainLine(work: ManagerCompletedWorkItem): string {
  return `Дата ${formatDisplayDate(work.completed_date)}`;
}

function workSecondaryLine(work: ManagerCompletedWorkItem): string {
  if (work.work_type === 'production') {
    return `SKU: ${nonEmpty(work.sku_name) ?? '—'}\nКоличество: ${quantity(work)}\nНачисленная зарплата\n${salary(work)} сум`;
  }
  return `Доп. работа: ${nonEmpty(work.additional_work_name) ?? '—'}\nНачисленная зарплата\n${salary(work)} сум`;
}

function projectPeriodMenu(
  input: P1NodeInput<'S03-E20'>,
): Section03ScreenProjection {
  const employeeId = scalar(context(input).employee_id, 'employee_id');
  const periods = Object.freeze([
    Object.freeze({ label: 'За сегодня', period: 'today' }),
    Object.freeze({ label: 'За неделю', period: 'week' }),
    Object.freeze({ label: 'За месяц', period: 'month' }),
    Object.freeze({ label: 'Последние 30 дней', period: 'last_30_days' }),
  ] as const);
  const controls = periods.map(({ label, period }) => actionControl({
    id: `period-${period}`,
    label,
    action: factory(input).presentation(
      'navigate0',
      { instanceId: `period-${period}`, ariaLabel: label },
      { employee_id: employeeId, period },
    ),
  }));
  const back = backButton(
    input,
    'navigateBack0',
    { employee_id: employeeId },
    'completed-works-period-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-E20',
    ariaLabel: 'Выполненные работы',
    fixedTopTitle: 'Выполненные работы',
    bridgeProjection: { nodeId: 'S03-E20', items: [...controls, back] },
    slots: {
      fixedTop: [],
      scroll: controls.map((item) => item.id),
      fixedBottom: [back.id],
    },
  });
}

function worksModel(input: P1NodeInput<'S03-E21'>): ManagerCompletedWorksResponse {
  return primary(input) as unknown as ManagerCompletedWorksResponse;
}

function validateWorksIdentity(
  model: ManagerCompletedWorksResponse,
  employeeId: string,
): void {
  if (model.employee.employee_id !== employeeId) {
    throw new Section03P2B1IdentityError(
      '$.employee.employee_id', employeeId, model.employee.employee_id,
    );
  }
  model.works.forEach((work, index) => {
    if (work.employee_id !== model.employee.employee_id) {
      throw new Section03P2B1IdentityError(
        `$.works[${index}].employee_id`,
        model.employee.employee_id,
        work.employee_id,
      );
    }
  });
}

function projectWorksList(
  input: P1NodeInput<'S03-E21'>,
): Section03ScreenProjection {
  const current = context(input);
  const employeeId = scalar(current.employee_id, 'employee_id');
  const period = requiredPeriod(current.period);
  const model = worksModel(input);
  validateWorksIdentity(model, employeeId);
  const rows: PresentationGraphBridgeItemInput[] = model.works.map((work) => {
    const id = `work-${work.work_item_id}`;
    const mainLine = workMainLine(work);
    const ariaLabel = `Открыть выполненную работу ${work.work_item_id}`;
    return Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.derivedWorkTypeList,
        work.work_type,
      ),
      interaction: interaction(factory(input).presentation(
        'navigate0',
        { instanceId: id, ariaLabel },
        {
          employee_id: employeeId,
          period,
          work_type: work.work_type,
          operation_id: work.operation_id,
        },
      )),
      mainLine: text(mainLine),
      secondaryLine: text(workSecondaryLine(work)),
      ariaLabel,
    });
  });
  if (rows.length === 0) {
    rows.push(message(
      'completed-works-empty',
      'Нет выполненных работ за выбранный период.',
      SECTION03_POLICY_ROOTS.staticInfoMessage,
    ));
  }
  const back = backButton(
    input,
    'navigateBack0',
    { employee_id: employeeId, period },
    'completed-works-list-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-E21',
    ariaLabel: 'Выполненные работы',
    fixedTopTitle: 'Выполненные работы',
    bridgeProjection: { nodeId: 'S03-E21', items: [...rows, back] },
    slots: {
      fixedTop: [],
      scroll: rows.map((item) => item.id),
      fixedBottom: [back.id],
    },
  });
}

function cardModel(
  input: P1NodeInput<'S03-E22'>,
): ManagerCompletedWorkCardResponse {
  return primary(input) as unknown as ManagerCompletedWorkCardResponse;
}

function validateCardIdentity(
  model: ManagerCompletedWorkCardResponse,
  current: Section03Context,
): void {
  const employeeId = scalar(current.employee_id, 'employee_id');
  const workType = scalar(current.work_type, 'work_type');
  const operationId = scalar(current.operation_id, 'operation_id');
  const checks = Object.freeze([
    Object.freeze({ field: '$.employee.employee_id', expected: employeeId, actual: model.employee.employee_id }),
    Object.freeze({ field: '$.work.employee_id', expected: employeeId, actual: model.work.employee_id }),
    Object.freeze({ field: '$.work.work_type', expected: workType, actual: model.work.work_type }),
    Object.freeze({ field: '$.work.operation_id', expected: operationId, actual: model.work.operation_id }),
  ]);
  const mismatch = checks.find((check) => check.expected !== check.actual);
  if (mismatch !== undefined) {
    throw new Section03P2B1IdentityError(
      mismatch.field, mismatch.expected, mismatch.actual,
    );
  }
}

function cardLines(
  model: ManagerCompletedWorkCardResponse,
): readonly PresentationGraphCardLineInput[] {
  const work = model.work;
  const detail = nonEmpty(work.additional_work_name);
  return Object.freeze([
    Object.freeze({ id: 'work-employee', label: text('Сотрудник'), value: text(model.employee.full_name) }),
    Object.freeze({ id: 'work-date', label: text('Дата'), value: text(formatDisplayDate(work.completed_date)) }),
    ...(work.work_type === 'production'
      ? [
          Object.freeze({ id: 'work-sku', label: text('SKU'), value: text(nonEmpty(work.sku_name) ?? '—') }),
          Object.freeze({ id: 'work-quantity', label: text('Количество'), value: text(quantity(work)) }),
        ]
      : detail === null
        ? []
        : [Object.freeze({ id: 'work-additional-name', content: text(detail) })]),
    Object.freeze({ id: 'work-salary', label: text('Начисленная зарплата'), value: text(`${salary(work)} сум`) }),
  ]);
}

function projectWorkCard(
  input: P1NodeInput<'S03-E22'>,
): Section03ScreenProjection {
  const current = context(input);
  const model = cardModel(input);
  validateCardIdentity(model, current);
  const employeeId = scalar(current.employee_id, 'employee_id');
  const period = requiredPeriod(current.period);
  const workType = requiredWorkType(current.work_type);
  const operationId = scalar(current.operation_id, 'operation_id');
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'completed-work-card',
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.derivedWorkTypeCard,
      model.work.work_type,
    ),
    lines: cardLines(model),
    ariaLabel: 'Выполненная работа',
  });
  const bottom: PresentationGraphBridgeItemInput[] = [];
  bottom.push(actionControl({
    id: 'completed-work-correction',
    label: 'Корректировка',
    action: factory(input).presentation(
      'navigate0',
      { instanceId: 'completed-work-correction', ariaLabel: 'Корректировка' },
      { correction_scope: 'employee', employee_id: employeeId, period, work_type: workType, operation_id: operationId },
    ),
    enabled: period === 'today' && model.work.work_type === 'production' && model.work.can_correct,
  }));
  const stornoLabel = model.work.is_reversed ? 'Сторнировано' : 'Сторно';
  bottom.push(actionControl({
    id: 'completed-work-storno',
    label: stornoLabel,
    action: factory(input).presentation(
      'navigate1',
      { instanceId: 'completed-work-storno', ariaLabel: stornoLabel },
      {
        employee_id: employeeId,
        period,
        work_type: workType,
        operation_id: operationId,
        ...(model.work.salary_entry_id === null ? {} : { salary_entry_id: model.work.salary_entry_id }),
      },
    ),
    enabled: period === 'today' && model.work.can_storno && !model.work.is_reversed && model.work.salary_entry_id !== null,
  }));
  bottom.push(backButton(
    input,
    'navigateBack0',
    { employee_id: employeeId, period },
    'completed-work-card-back',
  ));
  return defineSection03ScreenProjection({
    nodeId: 'S03-E22',
    ariaLabel: 'Выполненная работа',
    bridgeProjection: { nodeId: 'S03-E22', items: [card, ...bottom] },
    slots: {
      fixedTop: [],
      scroll: [card.id],
      fixedBottom: bottom.map((item) => item.id),
    },
  });
}

export function projectSection03P2B1(
  input: P1NodeInput<Section03P2B1SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-E20':
      return projectPeriodMenu(input as P1NodeInput<'S03-E20'>);
    case 'S03-E21':
      return projectWorksList(input as P1NodeInput<'S03-E21'>);
    case 'S03-E22':
      return projectWorkCard(input as P1NodeInput<'S03-E22'>);
  }
}
