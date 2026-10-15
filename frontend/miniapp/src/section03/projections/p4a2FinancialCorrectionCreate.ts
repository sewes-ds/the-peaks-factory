import { normalizeNumericInputForApi } from '../../foundation/graphObjects/PeaksNumericInputKeyboard';
import type {
  PresentationFormDraftController,
  PresentationGraphBridgeItemInput,
} from '../../foundation/presentation';
import { formatDisplayInteger } from '../../foundation/presentation';
import { validatePresentationFormValue } from '../../foundation/presentation/forms/validation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerSalaryCorrectionContextResponse,
  ManagerWorkplaceState,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  section03FormFields,
  type Section03ScreenProjection,
} from '../presentation';
import {
  actionButton,
  backButton,
  factory,
  nodeData,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P4A2_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-CF12',
  'S03-CF13',
  'S03-CF14',
] as const satisfies readonly Section03NodeId[]);

export type Section03P4A2SpecializedNodeId =
  typeof SECTION03_P4A2_SPECIALIZED_NODE_IDS[number];

export class Section03P4A2ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P4A2ProjectionError';
  }
}

function requiredContextText(
  context: Section03Context,
  field: keyof Section03Context,
): string {
  const value = context[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Section03P4A2ProjectionError(`Missing ${field}.`);
  }
  return value.trim();
}

function requiredController(
  input: P1NodeInput<'S03-CF12'> | P1NodeInput<'S03-CF13'>,
  fieldId: 'amount_uzs' | 'financial_correction_reason',
): PresentationFormDraftController {
  const controller = input.formController;
  if (controller === undefined || controller.fieldIds.length !== 1 || controller.fieldIds[0] !== fieldId) {
    throw new Section03P4A2ProjectionError(`Missing ${fieldId} form controller for ${input.nodeId}.`);
  }
  return controller;
}

function fieldItem(
  controller: PresentationFormDraftController,
  fieldId: 'amount_uzs' | 'financial_correction_reason',
): PresentationGraphBridgeItemInput {
  return Object.freeze({ kind: 'form-field' as const, id: `field-${fieldId}`, controller, fieldId });
}

function normalizedPositiveAmount(value: string): string {
  const definition = section03FormFields('S03-CF12')[0];
  if (definition === undefined) throw new Section03P4A2ProjectionError('CF12 amount definition is missing.');
  const validation = validatePresentationFormValue(
    definition,
    normalizeNumericInputForApi(value),
  );
  if (!validation.valid) throw new Section03P4A2ProjectionError('Invalid positive amount.');
  return validation.normalizedValue;
}

function normalizedReason(value: string): string {
  const definition = section03FormFields('S03-CF13')[0];
  if (definition === undefined) throw new Section03P4A2ProjectionError('CF13 comment definition is missing.');
  const validation = validatePresentationFormValue(definition, value);
  if (!validation.valid) throw new Section03P4A2ProjectionError('Invalid correction comment.');
  return validation.normalizedValue;
}

function committedAmount(controller: PresentationFormDraftController): string | null {
  const field = controller.field('amount_uzs');
  if (field.pending) return null;
  const definition = section03FormFields('S03-CF12')[0];
  if (definition === undefined) throw new Section03P4A2ProjectionError('CF12 amount definition is missing.');
  const validation = validatePresentationFormValue(
    definition,
    normalizeNumericInputForApi(field.value),
  );
  return validation.valid ? validation.normalizedValue : null;
}

function committedReason(controller: PresentationFormDraftController): string | null {
  if (!controller.valid || controller.field('financial_correction_reason').pending) return null;
  const committed = controller.commit().financial_correction_reason;
  if (typeof committed !== 'string') throw new Section03P4A2ProjectionError('CF13 comment commit is malformed.');
  return normalizedReason(committed);
}

function identity(context: Section03Context) {
  return Object.freeze({
    employee_id: requiredContextText(context, 'employee_id'),
    employee_shift_id: requiredContextText(context, 'employee_shift_id'),
  });
}

function modeAndType(context: Section03Context) {
  const correctionMode = context.correction_mode;
  if (correctionMode !== 'accrual' && correctionMode !== 'withholding') {
    throw new Section03P4A2ProjectionError('Invalid correction_mode.');
  }
  return Object.freeze({
    correction_mode: correctionMode,
    salary_correction_type_id: requiredContextText(context, 'salary_correction_type_id'),
  });
}

function projectAmount(
  input: P1NodeInput<'S03-CF12'>,
): Section03ScreenProjection {
  const context = nodeData(input).context;
  const employee = identity(context);
  const correction = modeAndType(context);
  const controller = requiredController(input, 'amount_uzs');
  const amount = committedAmount(controller);
  const field = fieldItem(controller, 'amount_uzs');
  const nextEvent = Object.freeze({
    ...employee,
    ...correction,
    ...(amount === null ? {} : { amount_uzs: amount }),
  });
  const next = actionButton({
    id: 'financial-correction-amount-next',
     label: 'Далее',
    ariaLabel: 'Далее',
    enabled: amount !== null,
    action: factory(input).presentation('navigate0', {
      instanceId: 'financial-correction-amount-next', ariaLabel: 'Далее',
    }, nextEvent),
  });
  const back = backButton(
    input,
    'navigateBack0',
    employee,
    'financial-correction-amount-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF12',
    ariaLabel: 'Финансовая корректировка',
    fixedTopTitle: 'Финансовая корректировка',
    bridgeProjection: { nodeId: 'S03-CF12', items: [field, next, back] },
    slots: { fixedTop: [], scroll: [field.id], fixedBottom: [next.id, back.id] },
  });
}

function projectComment(
  input: P1NodeInput<'S03-CF13'>,
): Section03ScreenProjection {
  const context = nodeData(input).context;
  const employee = identity(context);
  const correction = modeAndType(context);
  const amount = normalizedPositiveAmount(requiredContextText(context, 'amount_uzs'));
  const controller = requiredController(input, 'financial_correction_reason');
  const reason = committedReason(controller);
  const retained = Object.freeze({ ...employee, ...correction, amount_uzs: amount });
  const field = fieldItem(controller, 'financial_correction_reason');
  const nextEvent = Object.freeze({
    ...retained,
    ...(reason === null ? {} : { financial_correction_reason: reason }),
  });
  const next = actionButton({
    id: 'financial-correction-comment-next',
     label: 'Далее',
    ariaLabel: 'Далее',
    enabled: reason !== null,
    action: factory(input).presentation('navigate0', {
      instanceId: 'financial-correction-comment-next', ariaLabel: 'Далее',
    }, nextEvent),
  });
  const back = backButton(
    input,
    'navigateBack0',
    retained,
    'financial-correction-comment-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF13',
    ariaLabel: 'Комментарий',
    fixedTopTitle: 'Комментарий',
    bridgeProjection: { nodeId: 'S03-CF13', items: [field, next, back] },
    slots: { fixedTop: [], scroll: [field.id], fixedBottom: [next.id, back.id] },
  });
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function labeled(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function projectConfirmation(
  input: P1NodeInput<'S03-CF14'>,
): Section03ScreenProjection {
  const loaded = nodeData(input);
  const context = loaded.context;
  const employeeIdentity = identity(context);
  const correction = modeAndType(context);
  const primary = loaded.data.primary as unknown as ManagerSalaryCorrectionContextResponse | null;
  const supplemental = loaded.data.supplemental as unknown as ManagerWorkplaceState | null;
  if (primary === null) throw new Section03P4A2ProjectionError('CF14 fresh correction context is missing.');
  if (supplemental === null) throw new Section03P4A2ProjectionError('CF14 fresh workplace authority is missing.');
  const selected = primary.employees_with_today_shift.find(
    (employee) => employee.employee_id === employeeIdentity.employee_id,
  );
  if (selected === undefined) throw new Section03P4A2ProjectionError('CF14 fresh employee is missing.');
  if (selected.employee_shift_id !== employeeIdentity.employee_shift_id) {
    throw new Section03P4A2ProjectionError('CF14 fresh employee shift does not match.');
  }
  const freshTypeId = correction.correction_mode === 'accrual'
    ? primary.default_accrual_salary_correction_type_id
    : primary.default_withholding_salary_correction_type_id;
  if (correction.salary_correction_type_id !== freshTypeId) {
    throw new Section03P4A2ProjectionError('CF14 correction type is stale.');
  }
  if (
    !supplemental.sections.corrections.available_actions.includes('OPEN_CORRECTIONS') ||
    !loaded.data.availableActions.includes('OPEN_CORRECTIONS')
  ) {
    throw new Section03P4A2ProjectionError('CF14 fresh workplace lacks OPEN_CORRECTIONS.');
  }
  const positiveAmount = normalizedPositiveAmount(requiredContextText(context, 'amount_uzs'));
  const reason = normalizedReason(requiredContextText(context, 'financial_correction_reason'));
  const withholding = correction.correction_mode === 'withholding';
  const signedAmount = withholding ? `-${positiveAmount}` : positiveAmount;
  const event = Object.freeze({
    ...employeeIdentity,
    salary_correction_type_id: freshTypeId,
    correction_mode: correction.correction_mode,
    amount_uzs: signedAmount,
    financial_correction_reason: reason,
  });
  const lines = Object.freeze([
    contentOnly('financial-correction-confirm-prompt', 'Подтвердите корректировку:'),
    labeled('financial-correction-confirm-employee', 'Сотрудник', selected.employee_full_name),
    contentOnly('financial-correction-confirm-mode', withholding ? 'Удержание' : 'Начисление'),
    labeled('financial-correction-confirm-amount', 'Сумма', formatDisplayInteger(signedAmount)),
    labeled('financial-correction-confirm-comment', 'Комментарий', reason),
  ]);
  const confirmation: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'financial-correction-confirmation',
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.derivedCorrectionModeCard,
      withholding ? 'withholding' : 'accrual',
    ),
    lines,
    ariaLabel: 'Подтверждение финансовой корректировки',
  });
  const projected = factory(input).business('CREATE_APPROVE_SALARY_CORRECTION', {
    instanceId: 'financial-correction-create-approve',
    ariaLabel: withholding ? 'Удержать' : 'Начислить',
  }, event);
  if (projected.length !== 1) {
    throw new Section03P4A2ProjectionError('Runtime denied CREATE_APPROVE_SALARY_CORRECTION.');
  }
  const confirm = actionButton({
    id: 'financial-correction-create-approve',
     label: withholding ? 'Удержать' : 'Начислить',
    ariaLabel: withholding ? 'Удержать' : 'Начислить',
    action: projected[0]!,
  });
  const backEvent = Object.freeze({
    ...employeeIdentity,
    ...correction,
    amount_uzs: positiveAmount,
    financial_correction_reason: reason,
  });
  const back = backButton(
    input,
    'navigateBack0',
    backEvent,
    'financial-correction-confirm-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-CF14',
    ariaLabel: 'Подтверждение финансовой корректировки',
    bridgeProjection: { nodeId: 'S03-CF14', items: [confirmation, confirm, back] },
    slots: { fixedTop: [], scroll: [confirmation.id], fixedBottom: [confirm.id, back.id] },
  });
}

export function projectSection03P4A2(
  input: P1NodeInput<Section03P4A2SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-CF12': return projectAmount(input as P1NodeInput<'S03-CF12'>);
    case 'S03-CF13': return projectComment(input as P1NodeInput<'S03-CF13'>);
    case 'S03-CF14': return projectConfirmation(input as P1NodeInput<'S03-CF14'>);
  }
}
