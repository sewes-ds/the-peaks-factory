import type {
  PresentationFormDraftController,
  PresentationGraphBridgeItemInput,
} from '../../foundation/presentation';
import { formatDisplayDate, formatDisplayInteger } from '../../foundation/presentation';
import type {
  PresentationGraphCardLineInput,
  PresentationGraphSecondaryLineInput,
} from '../../foundation/presentation/graphBridge/model';
import { validatePresentationFormValue } from '../../foundation/presentation/forms/validation';
import type {
  ManagerCompletedWorkCardResponse,
  ManagerCompletedWorkItem,
  ManagerCompletedWorksResponse,
  ManagerEmployee,
  ManagerEmployees,
  ManagerWorkplaceState,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context, Section03Period, Section03WorkType } from '../program/context';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  section03EmployeeTuple,
  section03FormFields,
  type Section03ScreenProjection,
} from '../presentation';
import {
  actionButton,
  backButton,
  context,
  factory,
  interaction,
  message,
  nodeData,
  primary,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P4A3_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-CF20', 'S03-CF21', 'S03-CF22', 'S03-CF23', 'S03-CF24', 'S03-CF25',
] as const satisfies readonly Section03NodeId[]);

export type Section03P4A3SpecializedNodeId = typeof SECTION03_P4A3_SPECIALIZED_NODE_IDS[number];

export class Section03P4A3ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P4A3ProjectionError';
  }
}

function requiredText(value: string | number | undefined, field: keyof Section03Context): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Section03P4A3ProjectionError(`Missing ${field}.`);
  }
  return value.trim();
}

function requiredPeriod(value: Section03Period | undefined): Section03Period {
  if (value === undefined) throw new Section03P4A3ProjectionError('Missing period.');
  return value;
}

function requiredWorkType(value: Section03WorkType | undefined): Section03WorkType {
  if (value === undefined) throw new Section03P4A3ProjectionError('Missing work_type.');
  return value;
}

function nonEmpty(value: string | null): string | null {
  return value !== null && value.trim().length > 0 ? value.trim() : null;
}

function salary(work: ManagerCompletedWorkItem): string {
  return formatDisplayInteger(work.salary_amount_uzs.length > 0
    ? work.salary_amount_uzs
    : work.amount_uzs.length > 0 ? work.amount_uzs : '0');
}

function reversalSalary(work: ManagerCompletedWorkItem): string {
  return formatDisplayInteger(work.amount_uzs.length > 0
    ? work.amount_uzs
    : work.salary_amount_uzs.length > 0 ? work.salary_amount_uzs : '0');
}

function quantity(work: ManagerCompletedWorkItem): string {
  const value = work.quantity ?? work.current_quantity;
  return value === null ? '—' : formatDisplayInteger(value);
}

function workTitle(work: ManagerCompletedWorkItem): string {
  return `Дата ${formatDisplayDate(work.completed_date)}`;
}

function workDetail(work: ManagerCompletedWorkItem): string {
  return work.work_type === 'production'
    ? `SKU: ${nonEmpty(work.sku_name) ?? '—'}\nКоличество: ${quantity(work)}\nНачисленная зарплата\n${salary(work)} сум`
    : `Доп. работа: ${nonEmpty(work.additional_work_name) ?? '—'}\nНачисленная зарплата\n${salary(work)} сум`;
}

function workOperation(work: ManagerCompletedWorkItem): string {
  return work.work_type === 'production'
    ? `SKU: ${nonEmpty(work.sku_name) ?? '—'}\nКоличество: ${quantity(work)}`
    : `Доп. работа: ${nonEmpty(work.additional_work_name) ?? '—'}`;
}

function secondary(id: string, value: string, evidence: unknown): PresentationGraphSecondaryLineInput {
  return Object.freeze({
    id,
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendEmployeeSummary,
      evidence,
    ),
    content: text(value),
  });
}

function employeeSecondaryLines(
  employee: ManagerEmployee,
): readonly PresentationGraphSecondaryLineInput[] | undefined {
  const values = [
    employee.active_sku_name === null ? null : `SKU: ${employee.active_sku_name}`,
    employee.active_machine_name,
    employee.active_break_name,
    employee.active_additional_work_name,
  ].filter((value): value is string => value !== null);
  const evidence = section03EmployeeTuple(employee);
  return values.length === 0 ? undefined : Object.freeze(values.map((value, index) =>
    secondary(`reversal-employee-${employee.employee_id}-line-${index}`, value, evidence)));
}

function navigationControl(
  id: string,
  label: string,
  action: object,
  enabled = true,
): PresentationGraphBridgeItemInput {
  return actionButton({
    id,
    action,
    label,
    ariaLabel: label,
    enabled,
  });
}

function projectEmployees(input: P1NodeInput<'S03-CF20'>): Section03ScreenProjection {
  const model = primary(input) as unknown as ManagerEmployees;
  const employeeIds = new Set(model.employees.map((employee) => employee.employee_id));
  if (employeeIds.size !== model.employees.length) {
    throw new Section03P4A3ProjectionError('Duplicate employee identity.');
  }
  const rows: PresentationGraphBridgeItemInput[] = model.employees.map((employee) => {
    const id = `reversal-employee-${employee.employee_id}`;
    const ariaLabel = `Выбрать сотрудника ${employee.full_name}`;
    const secondaryLines = employeeSecondaryLines(employee);
    return Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.backendEmployeeList,
        section03EmployeeTuple(employee),
      ),
      interaction: interaction(factory(input).presentation(
        'navigate0',
        { instanceId: id, ariaLabel },
        { employee_id: employee.employee_id },
      )),
      mainLine: text(employee.full_name),
      ...(secondaryLines === undefined ? {} : { secondaryLines }),
      ariaLabel,
    });
  });
  if (rows.length === 0) rows.push(message('reversal-employees-empty', 'Нет сотрудников.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = backButton(input, 'navigateBack0', {}, 'reversal-employees-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF20', ariaLabel: 'Финансовая корректировка', fixedTopTitle: 'Финансовая корректировка',
    bridgeProjection: { nodeId: 'S03-CF20', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((row) => row.id), fixedBottom: [back.id] },
  });
}

function projectPeriod(input: P1NodeInput<'S03-CF21'>): Section03ScreenProjection {
  const employeeId = requiredText(context(input).employee_id, 'employee_id');
  const periods = Object.freeze([
    Object.freeze({ id: 'period-today', label: 'За сегодня', period: 'today' }),
    Object.freeze({ id: 'period-week', label: 'За неделю', period: 'week' }),
    Object.freeze({ id: 'period-month', label: 'За месяц', period: 'month' }),
    Object.freeze({ id: 'period-last_30_days', label: 'Последние 30 дней', period: 'last_30_days' }),
  ] as const);
  const controls = periods.map(({ id, label, period }) => navigationControl(
    id,
    label,
    factory(input).presentation('navigate0', { instanceId: id, ariaLabel: label }, { employee_id: employeeId, period }),
  ));
  const back = backButton(input, 'navigateBack0', { employee_id: employeeId }, 'reversal-period-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF21', ariaLabel: 'Финансовая корректировка', fixedTopTitle: 'Финансовая корректировка',
    bridgeProjection: { nodeId: 'S03-CF21', items: [...controls, back] },
    slots: { fixedTop: [], scroll: controls.map((control) => control.id), fixedBottom: [back.id] },
  });
}

function validateWorks(model: ManagerCompletedWorksResponse, employeeId: string): void {
  if (model.employee.employee_id !== employeeId) {
    throw new Section03P4A3ProjectionError('Completed-work employee does not match context.');
  }
  if (model.works.some((work) => work.employee_id !== model.employee.employee_id)) {
    throw new Section03P4A3ProjectionError('Completed-work row employee does not match response employee.');
  }
}

function projectWorks(input: P1NodeInput<'S03-CF22'>): Section03ScreenProjection {
  const current = context(input);
  const employeeId = requiredText(current.employee_id, 'employee_id');
  const period = requiredPeriod(current.period);
  const model = primary(input) as unknown as ManagerCompletedWorksResponse;
  validateWorks(model, employeeId);
  const rows: PresentationGraphBridgeItemInput[] = model.works.map((work) => {
    const id = `reversal-work-${work.work_item_id}`;
    const mainLine = workTitle(work);
    const ariaLabel = `Открыть выполненную работу ${work.work_item_id}`;
    return Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.derivedWorkTypeList,
        work.work_type,
      ),
      interaction: interaction(factory(input).presentation(
        'navigate0', { instanceId: id, ariaLabel },
        { employee_id: employeeId, period, work_type: work.work_type, operation_id: work.operation_id },
      )),
      mainLine: text(mainLine),
      secondaryLine: text(workDetail(work)),
      ariaLabel,
    });
  });
  if (rows.length === 0) rows.push(message('reversal-works-empty', 'Нет выполненных работ за выбранный период.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = backButton(input, 'navigateBack0', { employee_id: employeeId, period }, 'reversal-works-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF22', ariaLabel: 'Финансовая корректировка', fixedTopTitle: 'Финансовая корректировка',
    bridgeProjection: { nodeId: 'S03-CF22', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((row) => row.id), fixedBottom: [back.id] },
  });
}

function validateCard(model: ManagerCompletedWorkCardResponse, current: Section03Context): void {
  const employeeId = requiredText(current.employee_id, 'employee_id');
  const workType = requiredWorkType(current.work_type);
  const operationId = requiredText(current.operation_id, 'operation_id');
  if (model.employee.employee_id !== employeeId) throw new Section03P4A3ProjectionError('Fresh employee identity mismatch.');
  if (model.work.employee_id !== employeeId) throw new Section03P4A3ProjectionError('Fresh work employee identity mismatch.');
  if (model.work.work_type !== workType) throw new Section03P4A3ProjectionError('Fresh work type mismatch.');
  if (model.work.operation_id !== operationId) throw new Section03P4A3ProjectionError('Fresh operation identity mismatch.');
}

function labeled(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function cardLines(model: ManagerCompletedWorkCardResponse): readonly PresentationGraphCardLineInput[] {
  const detail = nonEmpty(model.work.additional_work_name);
  return Object.freeze([
    labeled('reversal-work-employee', 'Сотрудник', model.employee.full_name),
    labeled('reversal-work-date', 'Дата', formatDisplayDate(model.work.completed_date)),
    ...(model.work.work_type === 'production'
      ? [
          labeled('reversal-work-sku', 'SKU', nonEmpty(model.work.sku_name) ?? '—'),
          labeled('reversal-work-quantity', 'Количество', quantity(model.work)),
        ]
      : detail === null ? [] : [contentOnly('reversal-work-additional-name', detail)]),
    labeled('reversal-work-salary', 'Начисленная зарплата', `${salary(model.work)} сум`),
  ]);
}

function projectCard(input: P1NodeInput<'S03-CF23'>): Section03ScreenProjection {
  const current = context(input);
  const model = primary(input) as unknown as ManagerCompletedWorkCardResponse;
  validateCard(model, current);
  const employeeId = requiredText(current.employee_id, 'employee_id');
  const period = requiredPeriod(current.period);
  const workType = requiredWorkType(current.work_type);
  const operationId = requiredText(current.operation_id, 'operation_id');
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'reversal-work-card',
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.derivedWorkTypeCard,
      model.work.work_type,
    ),
    lines: cardLines(model), ariaLabel: 'Выполненная работа',
  });
  const salaryEntryId = nonEmpty(model.work.salary_entry_id);
  const stornoLabel = model.work.is_reversed ? 'Сторнировано' : 'Сторно';
  const stornoEnabled = period === 'today' && model.work.can_storno && !model.work.is_reversed && salaryEntryId !== null;
  const bottom: PresentationGraphBridgeItemInput[] = [navigationControl(
    'reversal-open-confirmation',
    stornoLabel,
    factory(input).presentation(
      'navigate0',
      { instanceId: 'reversal-open-confirmation', ariaLabel: stornoLabel },
      {
        employee_id: employeeId,
        period,
        work_type: workType,
        operation_id: operationId,
        ...(salaryEntryId === null ? {} : { salary_entry_id: salaryEntryId }),
      },
    ),
    stornoEnabled,
  )];
  bottom.push(backButton(input, 'navigateBack0', { employee_id: employeeId, period }, 'reversal-card-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF23', ariaLabel: 'Выполненная работа',
    bridgeProjection: { nodeId: 'S03-CF23', items: [card, ...bottom] },
    slots: { fixedTop: [], scroll: [card.id], fixedBottom: bottom.map((item) => item.id) },
  });
}

function requiredController(input: P1NodeInput<'S03-CF24'>): PresentationFormDraftController {
  const controller = input.formController;
  if (controller === undefined || controller.fieldIds.length !== 1 || controller.fieldIds[0] !== 'reversal_reason') {
    throw new Section03P4A3ProjectionError('Missing reversal_reason form controller.');
  }
  return controller;
}

function committedReason(controller: PresentationFormDraftController): string | null {
  const field = controller.field('reversal_reason');
  if (field.pending) return null;
  const definition = section03FormFields('S03-CF24')[0];
  if (definition === undefined) throw new Section03P4A3ProjectionError('Missing reversal_reason definition.');
  const validation = validatePresentationFormValue(definition, field.value);
  return validation.valid ? validation.normalizedValue : null;
}

function routeIdentity(current: Section03Context) {
  return Object.freeze({
    employee_id: requiredText(current.employee_id, 'employee_id'),
    period: requiredPeriod(current.period),
    work_type: requiredWorkType(current.work_type),
    operation_id: requiredText(current.operation_id, 'operation_id'),
  });
}

function projectReason(input: P1NodeInput<'S03-CF24'>): Section03ScreenProjection {
  const current = context(input);
  const identity = routeIdentity(current);
  const salaryEntryId = requiredText(current.salary_entry_id, 'salary_entry_id');
  const controller = requiredController(input);
  const reason = committedReason(controller);
  const field: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'form-field' as const, id: 'field-reversal_reason', controller, fieldId: 'reversal_reason',
  });
  const next = actionButton({
    id: 'reversal-reason-next', label: 'Далее', ariaLabel: 'Далее',
    enabled: reason !== null,
    action: factory(input).presentation(
      'navigate0',
      { instanceId: 'reversal-reason-next', ariaLabel: 'Далее' },
      { ...identity, salary_entry_id: salaryEntryId, ...(reason === null ? {} : { reversal_reason: reason }) },
    ),
  });
  const back = backButton(
    input,
    'navigateBack0',
    identity,
    'reversal-reason-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF24', ariaLabel: 'Комментарий', fixedTopTitle: 'Комментарий',
    bridgeProjection: { nodeId: 'S03-CF24', items: [field, next, back] },
    slots: { fixedTop: [], scroll: [field.id], fixedBottom: [next.id, back.id] },
  });
}

function projectConfirmation(input: P1NodeInput<'S03-CF25'>): Section03ScreenProjection {
  const loaded = nodeData(input);
  const current = loaded.context;
  const identity = routeIdentity(current);
  const model = loaded.data.primary as unknown as ManagerCompletedWorkCardResponse | null;
  const workplace = loaded.data.supplemental as unknown as ManagerWorkplaceState | null;
  if (model === null) throw new Section03P4A3ProjectionError('Fresh completed-work card is missing.');
  if (workplace === null) throw new Section03P4A3ProjectionError('Fresh workplace authority is missing.');
  validateCard(model, current);
  const salaryEntryId = nonEmpty(model.work.salary_entry_id);
  if (salaryEntryId === null) throw new Section03P4A3ProjectionError('Fresh salary entry is missing.');
  if (salaryEntryId !== requiredText(current.salary_entry_id, 'salary_entry_id')) {
    throw new Section03P4A3ProjectionError('Fresh salary entry identity mismatch.');
  }
  if (!model.work.can_storno) throw new Section03P4A3ProjectionError('Fresh work is not reversible.');
  if (model.work.is_reversed) throw new Section03P4A3ProjectionError('Fresh work is already reversed.');
  const reason = requiredText(current.reversal_reason, 'reversal_reason');
  if (!workplace.sections.corrections.available_actions.includes('OPEN_CORRECTIONS') ||
      !loaded.data.availableActions.includes('OPEN_CORRECTIONS')) {
    throw new Section03P4A3ProjectionError('Fresh corrections authority is missing.');
  }
  const event = Object.freeze({ salary_entry_id: salaryEntryId, reversal_reason: reason });
  const business = factory(input).business(
    'REVERSE_SALARY_ENTRY',
    { instanceId: 'reversal-confirm', ariaLabel: 'Сторно' },
    event,
  );
  if (business.length !== 1) throw new Section03P4A3ProjectionError('Runtime denied REVERSE_SALARY_ENTRY.');
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'reversal-confirmation',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticDangerCard, null),
    ariaLabel: 'Подтверждение сторно',
    lines: Object.freeze([
      contentOnly('reversal-confirm-prompt', 'Подтвердите сторно:'),
      labeled('reversal-confirm-employee', 'Сотрудник', model.employee.full_name),
      labeled('reversal-confirm-date', 'Дата', formatDisplayDate(model.work.completed_date)),
      labeled('reversal-confirm-operation', 'Операция', workOperation(model.work)),
      labeled('reversal-confirm-salary', 'Начисленная зарплата', `${reversalSalary(model.work)} сум`),
      labeled('reversal-confirm-comment', 'Комментарий', reason),
    ]),
  });
  const confirm = actionButton({
    id: 'reversal-confirm', label: 'Сторно', ariaLabel: 'Сторно', action: business[0]!,
  });
  const back = backButton(
    input,
    'navigateBack0',
    { ...identity, salary_entry_id: salaryEntryId, reversal_reason: reason },
    'reversal-confirm-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF25', ariaLabel: 'Подтверждение сторно',
    bridgeProjection: { nodeId: 'S03-CF25', items: [card, confirm, back] },
    slots: { fixedTop: [], scroll: [card.id], fixedBottom: [confirm.id, back.id] },
  });
}

export function projectSection03P4A3(
  input: P1NodeInput<Section03P4A3SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-CF20': return projectEmployees(input as P1NodeInput<'S03-CF20'>);
    case 'S03-CF21': return projectPeriod(input as P1NodeInput<'S03-CF21'>);
    case 'S03-CF22': return projectWorks(input as P1NodeInput<'S03-CF22'>);
    case 'S03-CF23': return projectCard(input as P1NodeInput<'S03-CF23'>);
    case 'S03-CF24': return projectReason(input as P1NodeInput<'S03-CF24'>);
    case 'S03-CF25': return projectConfirmation(input as P1NodeInput<'S03-CF25'>);
  }
}
