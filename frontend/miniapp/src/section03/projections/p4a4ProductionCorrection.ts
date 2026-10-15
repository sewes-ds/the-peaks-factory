import { normalizeNumericInputForApi } from '../../foundation/graphObjects/PeaksNumericInputKeyboard';
import type {
  PresentationFormDraftController,
  PresentationGraphBridgeItemInput,
} from '../../foundation/presentation';
import { formatDisplayDate, formatDisplayInteger } from '../../foundation/presentation';
import { validatePresentationFormValue } from '../../foundation/presentation/forms/validation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerCompletedWorkItem,
  ManagerEmployees,
  ManagerMachineCompletedProductionOperation,
  ManagerMachines,
  ManagerProductionCompletedOperationsResponse,
  ManagerWorkplaceState,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type {
  Section03Context,
  Section03Period,
  Section03ProductionCorrectionMode,
} from '../program/context';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  section03EmployeeTuple,
  section03MachineTuple,
  section03FormFields,
  type Section03ScreenProjection,
} from '../presentation';
import { resolveSection03ProductionCorrectionMath } from '../presentation/productionCorrectionMath';
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

export const SECTION03_P4A4_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-CP00',
  'S03-CP10',
  'S03-CP11',
  'S03-CP12',
  'S03-CP13',
  'S03-CP14',
  'S03-CP15',
  'S03-CP16',
  'S03-CP20',
] as const satisfies readonly Section03NodeId[]);

export type Section03P4A4SpecializedNodeId = typeof SECTION03_P4A4_SPECIALIZED_NODE_IDS[number];

export class Section03P4A4ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P4A4ProjectionError';
  }
}

type CorrectionScope =
  | Readonly<{ correction_scope: 'employee'; employee_id: string }>
  | Readonly<{ correction_scope: 'machine'; machine_id: string }>;

type SelectedOperation = Readonly<{
  operation_id: string;
  production_operation_id: string;
  employee_id: string;
  employee_full_name: string;
  completed_date: string;
  sku_name: string | null;
  quantity: string;
  current_quantity: string;
  correction_base_quantity: string;
  machine_id: string;
  machine_name: string;
  can_correct: boolean;
}>;

function requiredText(value: string | number | undefined, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Section03P4A4ProjectionError(`Missing ${field}.`);
  }
  return value.trim();
}

function correctionScope(current: Section03Context): CorrectionScope {
  const employee = current.employee_id;
  const machine = current.machine_id;
  if (current.correction_scope === 'employee' && employee !== undefined && machine === undefined) {
    return Object.freeze({ correction_scope: 'employee', employee_id: requiredText(employee, 'employee_id') });
  }
  if (current.correction_scope === 'machine' && machine !== undefined && employee === undefined) {
    return Object.freeze({ correction_scope: 'machine', machine_id: requiredText(machine, 'machine_id') });
  }
  throw new Section03P4A4ProjectionError('Expected one explicit matching correction scope.');
}

function period(current: Section03Context): Section03Period {
  if (current.period === undefined) throw new Section03P4A4ProjectionError('Missing period.');
  return current.period;
}

function productionIdentity(current: Section03Context) {
  if (current.work_type !== 'production') throw new Section03P4A4ProjectionError('Expected production work_type.');
  return Object.freeze({
    ...correctionScope(current),
    period: period(current),
    work_type: 'production' as const,
    operation_id: requiredText(current.operation_id, 'operation_id'),
  });
}

function correctionMode(current: Section03Context): Section03ProductionCorrectionMode {
  const mode = current.production_correction_mode;
  if (mode !== 'increase' && mode !== 'decrease' && mode !== 'final') {
    throw new Section03P4A4ProjectionError('Invalid production_correction_mode.');
  }
  return mode;
}

function navigation(
  input: P1NodeInput,
  id: string,
  label: string,
  actionId: string,
  event: Section03Context,
): PresentationGraphBridgeItemInput {
  return actionButton({
    id,
     label,
    ariaLabel: label,
    action: factory(input).presentation(actionId, { instanceId: id, ariaLabel: label }, event),
  });
}

function selection(
  input: P1NodeInput,
  id: string,
  label: string,
  actionId: string,
  event: Section03Context,
): PresentationGraphBridgeItemInput {
  return actionButton({
    id,
     action: factory(input).presentation(
      actionId,
      { instanceId: id, ariaLabel: label },
      event,
    ),
    label,
    ariaLabel: label,
  });
}

function screen(
  nodeId: Section03P4A4SpecializedNodeId,
  title: string,
  scroll: readonly PresentationGraphBridgeItemInput[],
  bottom: readonly PresentationGraphBridgeItemInput[],
): Section03ScreenProjection {
  return defineSection03ScreenProjection({
    nodeId,
    ariaLabel: title,
    fixedTopTitle: title,
    bridgeProjection: { nodeId, items: [...scroll, ...bottom] },
    slots: { fixedTop: [], scroll: scroll.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}

function projectOrigin(input: P1NodeInput<'S03-CP00'>): Section03ScreenProjection {
  const controls = [
    navigation(input, 'production-correction-by-employee', 'По сотруднику', 'navigate0', { correction_scope: 'employee' }),
    navigation(input, 'production-correction-by-machine', 'По станку', 'navigate1', { correction_scope: 'machine' }),
  ];
  const back = backButton(input, 'navigateBack0', {}, 'production-correction-scope-back');
  return screen('S03-CP00', 'Производственная корректировка', controls, [back]);
}

function projectEmployees(input: P1NodeInput<'S03-CP10'>): Section03ScreenProjection {
  const model = primary(input) as unknown as ManagerEmployees;
  const identities = new Set<string>();
  const rows: PresentationGraphBridgeItemInput[] = model.employees.map((employee) => {
    if (identities.has(employee.employee_id)) throw new Section03P4A4ProjectionError('Duplicate employee identity.');
    identities.add(employee.employee_id);
    const id = `production-correction-employee-${employee.employee_id}`;
    const ariaLabel = `Выбрать сотрудника ${employee.full_name}`;
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
        { correction_scope: 'employee', employee_id: employee.employee_id },
      )),
      mainLine: text(employee.full_name),
      ariaLabel,
    });
  });
  if (rows.length === 0) rows.push(message('production-correction-employees-empty', 'Нет сотрудников.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = backButton(input, 'navigateBack0', {}, 'production-correction-employees-back');
  return screen('S03-CP10', 'Производственная корректировка', rows, [back]);
}

function projectMachines(input: P1NodeInput<'S03-CP20'>): Section03ScreenProjection {
  const model = primary(input) as unknown as ManagerMachines;
  const identities = new Set<string>();
  const rows: PresentationGraphBridgeItemInput[] = model.machines.map((machine) => {
    if (identities.has(machine.machine_id)) throw new Section03P4A4ProjectionError('Duplicate machine identity.');
    identities.add(machine.machine_id);
    const id = `production-correction-machine-${machine.machine_id}`;
    const ariaLabel = `Выбрать станок ${machine.machine_name}`;
    return Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.backendMachineList,
        section03MachineTuple(machine),
      ),
      interaction: interaction(factory(input).presentation(
        'navigate0',
        { instanceId: id, ariaLabel },
        { correction_scope: 'machine', machine_id: machine.machine_id },
      )),
      mainLine: text(machine.machine_name),
      ariaLabel,
    });
  });
  if (rows.length === 0) rows.push(message('production-correction-machines-empty', 'Нет станков.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = backButton(input, 'navigateBack0', {}, 'production-correction-machines-back');
  return screen('S03-CP20', 'Производственная корректировка', rows, [back]);
}

function projectPeriod(input: P1NodeInput<'S03-CP11'>): Section03ScreenProjection {
  const selectedScope = correctionScope(context(input));
  const periods = Object.freeze([
    Object.freeze({ id: 'production-correction-period-today', label: 'За сегодня', value: 'today' as const }),
    Object.freeze({ id: 'production-correction-period-week', label: 'За неделю', value: 'week' as const }),
    Object.freeze({ id: 'production-correction-period-month', label: 'За месяц', value: 'month' as const }),
    Object.freeze({ id: 'production-correction-period-last-30-days', label: 'Последние 30 дней', value: 'last_30_days' as const }),
  ]);
  const controls = periods.map((item) => navigation(
    input,
    item.id,
    item.label,
    'navigate0',
    { ...selectedScope, period: item.value },
  ));
  const back = backButton(
    input,
    'navigateBack0',
    selectedScope,
    'production-correction-period-back',
  );
  return screen('S03-CP11', 'Производственная корректировка', controls, [back]);
}

function employeeOperation(work: ManagerCompletedWorkItem): SelectedOperation {
  if (
    work.work_type !== 'production' ||
    work.production_operation_id === null ||
    work.quantity === null ||
    work.current_quantity === null ||
    work.correction_base_quantity === null ||
    work.machine_id === null ||
    work.machine_name === null
  ) {
    throw new Section03P4A4ProjectionError('Malformed employee production operation.');
  }
  return Object.freeze({
    operation_id: work.operation_id,
    production_operation_id: work.production_operation_id,
    employee_id: work.employee_id,
    employee_full_name: work.employee_full_name,
    completed_date: work.completed_date,
    sku_name: work.sku_name,
    quantity: work.quantity,
    current_quantity: work.current_quantity,
    correction_base_quantity: work.correction_base_quantity,
    machine_id: work.machine_id,
    machine_name: work.machine_name,
    can_correct: work.can_correct,
  });
}

function machineOperation(work: ManagerMachineCompletedProductionOperation): SelectedOperation {
  return employeeOperation(work);
}

function operationsFor(
  model: ManagerProductionCompletedOperationsResponse,
  selectedScope: CorrectionScope,
): readonly SelectedOperation[] {
  if ('employee_id' in selectedScope) {
    if (!('works' in model) || model.employee.employee_id !== selectedScope.employee_id) {
      throw new Section03P4A4ProjectionError('Employee production source identity mismatch.');
    }
    return Object.freeze(model.works.map(employeeOperation));
  }
  if (!('operations' in model) || model.machine.machine_id !== selectedScope.machine_id) {
    throw new Section03P4A4ProjectionError('Machine production source identity mismatch.');
  }
  return Object.freeze(model.operations.map(machineOperation));
}

export function formatCompletedOperationDate(value: string): string {
  try {
    return formatDisplayDate(value);
  } catch {
    throw new Section03P4A4ProjectionError('Invalid completed operation date.');
  }
}

function projectOperations(input: P1NodeInput<'S03-CP12'>): Section03ScreenProjection {
  const current = context(input);
  const selectedScope = correctionScope(current);
  const selectedPeriod = period(current);
  const model = primary(input) as unknown as ManagerProductionCompletedOperationsResponse;
  const operations = operationsFor(model, selectedScope);
  const rows: PresentationGraphBridgeItemInput[] = operations.map((operation) => {
    const id = `production-correction-operation-${operation.operation_id}`;
    const date = formatCompletedOperationDate(operation.completed_date);
    const sku = operation.sku_name ?? '—';
    const ariaLabel = `Выбрать производственную операцию: дата ${date}, SKU ${sku}, станок ${operation.machine_name}`;
    return Object.freeze({
      kind: 'card' as const,
      id,
      presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticPositiveCard, null),
      interaction: interaction(factory(input).presentation(
        'navigate0',
        { instanceId: id, ariaLabel },
        { ...selectedScope, period: selectedPeriod, work_type: 'production', operation_id: operation.operation_id },
      ), selectedPeriod === 'today' && operation.can_correct),
      lines: Object.freeze([
        Object.freeze({ id: `${id}-date`, label: text('Дата'), value: text(date) }),
        Object.freeze({ id: `${id}-sku`, label: text('SKU'), value: text(sku) }),
        Object.freeze({ id: `${id}-quantity`, label: text('Количество'), value: text(formatDisplayInteger(operation.quantity)) }),
        Object.freeze({ id: `${id}-machine`, label: text('Станок'), value: text(operation.machine_name) }),
      ]),
      ariaLabel,
    });
  });
  if (rows.length === 0) {
    rows.push(message('production-correction-operations-empty', 'Нет производственных операций за выбранный период.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  }
  const back = backButton(
    input,
    'navigateBack0',
    { ...selectedScope, period: selectedPeriod },
    'production-correction-operations-back',
  );
  return screen('S03-CP12', 'Производственная корректировка', rows, [back]);
}

function freshSelectedOperation(input: P1NodeInput<'S03-CP13' | 'S03-CP16'>): SelectedOperation {
  const current = context(input);
  const model = primary(input) as unknown as ManagerProductionCompletedOperationsResponse;
  const matches = operationsFor(model, correctionScope(current)).filter(
    (operation) => operation.operation_id === requiredText(current.operation_id, 'operation_id'),
  );
  if (matches.length !== 1) throw new Section03P4A4ProjectionError('Fresh operation identity is ambiguous or missing.');
  return matches[0]!;
}

function projectMode(input: P1NodeInput<'S03-CP13'>): Section03ScreenProjection {
  const current = context(input);
  const identity = productionIdentity(current);
  freshSelectedOperation(input);
  const controls = [
    selection(input, 'production-correction-mode-increase', 'Увеличить', 'navigate0', { ...identity, production_correction_mode: 'increase' }),
    selection(input, 'production-correction-mode-decrease', 'Уменьшить', 'navigate0', { ...identity, production_correction_mode: 'decrease' }),
    selection(input, 'production-correction-mode-final', 'Указать итоговое количество', 'navigate0', { ...identity, production_correction_mode: 'final' }),
  ];
  const back = backButton(
    input,
    'navigateBack0',
    { ...correctionScope(current), period: identity.period },
    'production-correction-mode-back',
  );
  return screen('S03-CP13', 'Производственная корректировка', controls, [back]);
}

function requiredController(
  input: P1NodeInput<'S03-CP14' | 'S03-CP15'>,
  fieldId: 'correction_quantity' | 'production_correction_reason',
): PresentationFormDraftController {
  const controller = input.formController;
  if (controller === undefined || controller.fieldIds.length !== 1 || controller.fieldIds[0] !== fieldId) {
    throw new Section03P4A4ProjectionError(`Missing ${fieldId} form controller.`);
  }
  return controller;
}

function normalizedQuantity(value: string, mode: Section03ProductionCorrectionMode): string {
  const definition = section03FormFields('S03-CP14')[0];
  if (definition === undefined) throw new Section03P4A4ProjectionError('Missing correction_quantity definition.');
  const validation = validatePresentationFormValue(definition, normalizeNumericInputForApi(value));
  if (!validation.valid) throw new Section03P4A4ProjectionError('Invalid correction quantity.');
  if ((mode === 'increase' || mode === 'decrease') && /^0(?:\.0+)?$/.test(validation.normalizedValue)) {
    throw new Section03P4A4ProjectionError('Positive correction quantity is required.');
  }
  return validation.normalizedValue;
}

function committedQuantity(controller: PresentationFormDraftController, mode: Section03ProductionCorrectionMode): string | null {
  const field = controller.field('correction_quantity');
  if (field.pending) return null;
  try {
    return normalizedQuantity(field.value, mode);
  } catch {
    return null;
  }
}

function projectQuantity(input: P1NodeInput<'S03-CP14'>): Section03ScreenProjection {
  const current = context(input);
  const identity = productionIdentity(current);
  const mode = correctionMode(current);
  const controller = requiredController(input, 'correction_quantity');
  const quantity = committedQuantity(controller, mode);
  const field: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'form-field' as const,
    id: 'field-correction_quantity',
    controller,
    fieldId: 'correction_quantity',
  });
  const next = actionButton({
    id: 'production-correction-quantity-next',
     label: 'Далее',
    ariaLabel: 'Далее',
    enabled: quantity !== null,
    action: factory(input).presentation(
      'navigate0',
      { instanceId: 'production-correction-quantity-next', ariaLabel: 'Далее' },
      { ...identity, production_correction_mode: mode, ...(quantity === null ? {} : { correction_quantity: quantity }) },
    ),
  });
  const back = backButton(
    input,
    'navigateBack0',
    { ...correctionScope(current), period: identity.period, work_type: 'production', operation_id: identity.operation_id },
    'production-correction-quantity-back',
  );
  return screen('S03-CP14', 'Производственная корректировка', [field], [next, back]);
}

function normalizedReason(value: string): string {
  const definition = section03FormFields('S03-CP15')[0];
  if (definition === undefined) throw new Section03P4A4ProjectionError('Missing production_correction_reason definition.');
  const validation = validatePresentationFormValue(definition, value);
  if (!validation.valid) throw new Section03P4A4ProjectionError('Invalid production correction reason.');
  return validation.normalizedValue;
}

function committedReason(controller: PresentationFormDraftController): string | null {
  const field = controller.field('production_correction_reason');
  if (field.pending) return null;
  try {
    return normalizedReason(field.value);
  } catch {
    return null;
  }
}

function routeWithQuantity(current: Section03Context) {
  const identity = productionIdentity(current);
  const mode = correctionMode(current);
  return Object.freeze({
    ...identity,
    production_correction_mode: mode,
    correction_quantity: normalizedQuantity(requiredText(current.correction_quantity, 'correction_quantity'), mode),
  });
}

function projectComment(input: P1NodeInput<'S03-CP15'>): Section03ScreenProjection {
  const retained = routeWithQuantity(context(input));
  const controller = requiredController(input, 'production_correction_reason');
  const reason = committedReason(controller);
  const field: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'form-field' as const,
    id: 'field-production_correction_reason',
    controller,
    fieldId: 'production_correction_reason',
  });
  const next = actionButton({
    id: 'production-correction-comment-next',
     label: 'Далее',
    ariaLabel: 'Далее',
    enabled: reason !== null,
    action: factory(input).presentation(
      'navigate0',
      { instanceId: 'production-correction-comment-next', ariaLabel: 'Далее' },
      { ...retained, ...(reason === null ? {} : { production_correction_reason: reason }) },
    ),
  });
  const back = backButton(input, 'navigateBack0', retained, 'production-correction-comment-back');
  return screen('S03-CP15', 'Комментарий', [field], [next, back]);
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function labeled(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function projectConfirmation(input: P1NodeInput<'S03-CP16'>): Section03ScreenProjection {
  const loaded = nodeData(input);
  const current = loaded.context;
  const retained = routeWithQuantity(current);
  const reason = normalizedReason(requiredText(current.production_correction_reason, 'production_correction_reason'));
  const operation = freshSelectedOperation(input);
  if (operation.production_operation_id.length === 0) throw new Section03P4A4ProjectionError('Fresh production operation ID is missing.');
  if (operation.current_quantity !== operation.correction_base_quantity) {
    throw new Section03P4A4ProjectionError('Fresh correction base does not equal current quantity.');
  }
  if ('employee_id' in retained) {
    if (operation.employee_id !== retained.employee_id || !operation.can_correct) {
      throw new Section03P4A4ProjectionError('Fresh employee operation is not correctable.');
    }
  } else if (operation.machine_id !== retained.machine_id || !operation.can_correct) {
    throw new Section03P4A4ProjectionError('Fresh machine operation is not correctable.');
  }
  const workplace = loaded.data.supplemental as unknown as ManagerWorkplaceState | null;
  if (
    workplace === null ||
    !workplace.sections.corrections.available_actions.includes('OPEN_CORRECTIONS') ||
    !loaded.data.availableActions.includes('OPEN_CORRECTIONS')
  ) {
    throw new Section03P4A4ProjectionError('Fresh Corrections authority is missing.');
  }
  const math = resolveSection03ProductionCorrectionMath({
    mode: retained.production_correction_mode,
    freshBaseQuantity: operation.correction_base_quantity,
    correctionQuantity: retained.correction_quantity,
  });
  const event = Object.freeze({
    production_operation_id: operation.production_operation_id,
    quantity_produced: math.oldQuantity,
    correction_quantity: math.newQuantity,
    production_correction_reason: reason,
  });
  const business = factory(input).business(
    'CREATE_PRODUCTION_CORRECTION',
    { instanceId: 'production-correction-confirm', ariaLabel: 'Корректировать' },
    event,
  );
  if (business.length !== 1) throw new Section03P4A4ProjectionError('Runtime denied CREATE_PRODUCTION_CORRECTION.');
  const displayedOldQuantity = formatDisplayInteger(math.oldQuantity);
  const displayedNewQuantity = formatDisplayInteger(math.newQuantity);
  const displayedDelta = BigInt(displayedNewQuantity) - BigInt(displayedOldQuantity);
  const displayedSignedDelta = displayedDelta > 0n ? `+${displayedDelta}` : displayedDelta.toString();
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'production-correction-confirmation',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticPositiveCard, null),
    ariaLabel: 'Подтверждение производственной корректировки',
    lines: Object.freeze([
      contentOnly('production-correction-confirm-prompt', 'Подтвердите корректировку производства:'),
      labeled('production-correction-confirm-employee', 'Сотрудник', operation.employee_full_name),
      labeled('production-correction-confirm-machine', 'Станок', operation.machine_name),
      labeled('production-correction-confirm-sku', 'SKU', operation.sku_name ?? '—'),
      labeled('production-correction-confirm-old', 'Старое количество', displayedOldQuantity),
      labeled('production-correction-confirm-delta', 'Корректировка', displayedSignedDelta),
      labeled('production-correction-confirm-new', 'Новое количество', displayedNewQuantity),
    ]),
  });
  const confirm = actionButton({
    id: 'production-correction-confirm',
     label: 'Корректировать',
    ariaLabel: 'Корректировать',
    action: business[0]!,
  });
  const back = backButton(
    input,
    'navigateBack0',
    { ...retained, production_correction_reason: reason },
    'production-correction-confirm-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-CP16',
    ariaLabel: 'Подтверждение производственной корректировки',
    bridgeProjection: { nodeId: 'S03-CP16', items: [card, confirm, back] },
    slots: { fixedTop: [], scroll: [card.id], fixedBottom: [confirm.id, back.id] },
  });
}

export function projectSection03P4A4(
  input: P1NodeInput<Section03P4A4SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-CP00': return projectOrigin(input as P1NodeInput<'S03-CP00'>);
    case 'S03-CP10': return projectEmployees(input as P1NodeInput<'S03-CP10'>);
    case 'S03-CP11': return projectPeriod(input as P1NodeInput<'S03-CP11'>);
    case 'S03-CP12': return projectOperations(input as P1NodeInput<'S03-CP12'>);
    case 'S03-CP13': return projectMode(input as P1NodeInput<'S03-CP13'>);
    case 'S03-CP14': return projectQuantity(input as P1NodeInput<'S03-CP14'>);
    case 'S03-CP15': return projectComment(input as P1NodeInput<'S03-CP15'>);
    case 'S03-CP16': return projectConfirmation(input as P1NodeInput<'S03-CP16'>);
    case 'S03-CP20': return projectMachines(input as P1NodeInput<'S03-CP20'>);
  }
}
