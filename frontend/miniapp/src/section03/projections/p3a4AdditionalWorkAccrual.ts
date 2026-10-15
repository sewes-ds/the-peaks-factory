import { normalizeNumericInputForApi } from '../../foundation/graphObjects/PeaksNumericInputKeyboard';
import type { PresentationFormDraftController } from '../../foundation/presentation/forms/draft';
import { validatePresentationFormValue } from '../../foundation/presentation/forms/validation';
import { formatDisplayInteger, type PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerAdditionalWorkAction,
  ManagerAdditionalWorkItem,
  ManagerAdditionalWorksResponse,
} from '../contracts';
import type { Section03NodeId } from '../program';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03AdditionalWorkTuple,
  section03Authority,
  type Section03ScreenProjection,
} from '../presentation';
import {
  actionButton,
  backButton,
  factory,
  hasAction,
  nodeData,
  primary,
  text,
  type P1NodeInput,
} from './common';
import { additionalWorkEntityLines } from './additionalWorkCardLines';

export const SECTION03_P3A4_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-AW50',
  'S03-AW51',
  'S03-AW52',
  'S03-AW53',
  'S03-AW54',
] as const satisfies readonly Section03NodeId[]);

export type Section03P3A4SpecializedNodeId =
  typeof SECTION03_P3A4_SPECIALIZED_NODE_IDS[number];

export class Section03P3A4ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P3A4ProjectionError';
  }
}

function model(input: P1NodeInput<Section03P3A4SpecializedNodeId>): ManagerAdditionalWorksResponse {
  return primary(input) as unknown as ManagerAdditionalWorksResponse;
}

function selectedWaitingItem(
  input: P1NodeInput<Section03P3A4SpecializedNodeId>,
  requiredAction?: ManagerAdditionalWorkAction,
): ManagerAdditionalWorkItem {
  const workId = nodeData(input).context.additional_work_id;
  if (workId === undefined) throw new Section03P3A4ProjectionError('Missing selected additional_work_id.');
  const selected = Object.values(model(input).groups).flat().find(
    (item) => item.additional_work_id === workId,
  );
  if (selected === undefined) throw new Section03P3A4ProjectionError(`Selected additional work ${workId} is missing.`);
  if (selected.status !== 'waiting_accrual' || selected.ui_state !== 'waiting_accrual') {
    throw new Section03P3A4ProjectionError(`Selected additional work ${workId} is not waiting_accrual.`);
  }
  if (requiredAction !== undefined && !hasAction(selected.available_actions, requiredAction)) {
    throw new Section03P3A4ProjectionError(`Selected additional work ${workId} lacks ${requiredAction}.`);
  }
  return selected;
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function labeled(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function card(input: Readonly<{
  id: string;
  rootId: string;
  lines: readonly PresentationGraphCardLineInput[];
  ariaLabel: string;
}>): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'card' as const,
    id: input.id,
    presentationAuthority: section03Authority(input.rootId, null),
    lines: input.lines,
    ariaLabel: input.ariaLabel,
  });
}

function projectWaitingCard(input: P1NodeInput<'S03-AW50'>): Section03ScreenProjection {
  const item = selectedWaitingItem(input as P1NodeInput<Section03P3A4SpecializedNodeId>);
  const event = Object.freeze({ additional_work_id: item.additional_work_id });
  const workCard: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'additional-work-waiting-accrual-card',
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendAdditionalWorkCard,
      section03AdditionalWorkTuple(item),
    ),
    lines: additionalWorkEntityLines({
      idPrefix: 'additional-work-accrual',
      employeeFullName: item.employee_full_name,
      additionalWorkName: item.additional_work_name,
    }),
    ariaLabel: 'Доп. работа требует начисления',
  });
  const accrue = actionButton({
    id: 'additional-work-open-accrual',     label: 'Начислить зарплату', ariaLabel: 'Начислить зарплату',
    action: factory(input).presentation('navigate0', {
      instanceId: 'additional-work-open-accrual', ariaLabel: 'Начислить зарплату',
    }, event),
    enabled: hasAction(item.available_actions, 'ACCRUE_ADDITIONAL_WORK_SALARY'),
  });
  const withoutAccrual = actionButton({
    id: 'additional-work-open-without-accrual',     label: 'Без начисления', ariaLabel: 'Без начисления',
    action: factory(input).presentation('navigate1', {
      instanceId: 'additional-work-open-without-accrual', ariaLabel: 'Без начисления',
    }, event),
    enabled: hasAction(item.available_actions, 'MARK_WITHOUT_ACCRUAL'),
  });
  const back = backButton(input, 'navigateBack0', event, 'additional-work-accrual-card-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-AW50', ariaLabel: 'Доп. работа требует начисления',
    bridgeProjection: { nodeId: 'S03-AW50', items: [workCard, accrue, withoutAccrual, back] },
    slots: { fixedTop: [], scroll: [workCard.id], fixedBottom: [accrue.id, withoutAccrual.id, back.id] },
  });
}

function requiredController(
  input: P1NodeInput<'S03-AW51'> | P1NodeInput<'S03-AW53'>,
  fieldId: 'amount_uzs' | 'without_accrual_reason',
): PresentationFormDraftController {
  if (input.formController === undefined || input.formController.fieldIds.length !== 1 || input.formController.fieldIds[0] !== fieldId) {
    throw new Section03P3A4ProjectionError(`Missing ${fieldId} form controller for ${input.nodeId}.`);
  }
  return input.formController;
}

function fieldItem(controller: PresentationFormDraftController, fieldId: string): PresentationGraphBridgeItemInput {
  return Object.freeze({ kind: 'form-field' as const, id: `field-${fieldId}`, controller, fieldId });
}

function committedAmount(controller: PresentationFormDraftController): string | null {
  const field = controller.field('amount_uzs');
  if (field.pending) return null;
  const normalizedComma = normalizeNumericInputForApi(field.value);
  const validation = validatePresentationFormValue(field.definition, normalizedComma);
  return validation.valid ? validation.normalizedValue : null;
}

function committedReason(controller: PresentationFormDraftController): string | null {
  if (!controller.valid || controller.field('without_accrual_reason').pending) return null;
  try {
    const reason = controller.commit().without_accrual_reason;
    return typeof reason === 'string' && reason.length > 0 ? reason : null;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'FORM_PENDING') return null;
    throw error;
  }
}

function projectForm(
  input: P1NodeInput<'S03-AW51'> | P1NodeInput<'S03-AW53'>,
): Section03ScreenProjection {
  const amountForm = input.nodeId === 'S03-AW51';
  const fieldId = amountForm ? 'amount_uzs' : 'without_accrual_reason';
  const controller = requiredController(input, fieldId);
  const value = amountForm ? committedAmount(controller) : committedReason(controller);
  const workId = nodeData(input).context.additional_work_id!;
  const event = Object.freeze({
    additional_work_id: workId,
    ...(value === null ? {} : amountForm ? { amount_uzs: value } : { without_accrual_reason: value }),
  });
  const field = fieldItem(controller, fieldId);
  const next = actionButton({
    id: amountForm ? 'additional-work-amount-next' : 'additional-work-reason-next',
 label: 'Далее', ariaLabel: 'Далее', enabled: value !== null,
    action: factory(input).presentation('navigate0', {
      instanceId: amountForm ? 'additional-work-amount-next' : 'additional-work-reason-next',
      ariaLabel: 'Далее',
    }, event),
  });
  const back = backButton(input, 'navigateBack0', { additional_work_id: workId },
    amountForm ? 'additional-work-amount-back' : 'additional-work-reason-back');
  const title = amountForm ? 'Введите сумму начисления' : 'Комментарий';
  return defineSection03ScreenProjection({
    nodeId: input.nodeId, ariaLabel: title, fixedTopTitle: title,
    bridgeProjection: { nodeId: input.nodeId, items: [field, next, back] },
    slots: { fixedTop: [], scroll: [field.id], fixedBottom: [next.id, back.id] },
  });
}

function projectConfirmation(
  input: P1NodeInput<'S03-AW52'> | P1NodeInput<'S03-AW54'>,
): Section03ScreenProjection {
  const accrue = input.nodeId === 'S03-AW52';
  const actionId = accrue ? 'ACCRUE_ADDITIONAL_WORK' : 'MARK_WITHOUT_ACCRUAL';
  const requiredAction = accrue ? 'ACCRUE_ADDITIONAL_WORK_SALARY' : 'MARK_WITHOUT_ACCRUAL';
  const item = selectedWaitingItem(input as P1NodeInput<Section03P3A4SpecializedNodeId>, requiredAction);
  const context = nodeData(input).context;
  const workId = item.additional_work_id;
  const amount = context.amount_uzs;
  const reason = context.without_accrual_reason;
  if (accrue && amount === undefined) throw new Section03P3A4ProjectionError('AW52 requires amount_uzs.');
  if (!accrue && reason === undefined) throw new Section03P3A4ProjectionError('AW54 requires without_accrual_reason.');
  const event = Object.freeze({
    additional_work_id: workId,
    ...(accrue ? { amount_uzs: amount! } : { without_accrual_reason: reason! }),
  });
  const lines = accrue
    ? Object.freeze([
        contentOnly('additional-work-accrual-prompt', 'Подтвердите начисление зарплаты:'),
        ...additionalWorkEntityLines({
          idPrefix: 'additional-work-accrual-confirm',
          employeeFullName: item.employee_full_name,
          additionalWorkName: item.additional_work_name,
        }),
        labeled('additional-work-accrual-amount', 'Начисленная зарплата', `${formatDisplayInteger(amount!)} сум`),
      ])
    : Object.freeze([
        contentOnly('additional-work-without-accrual-prompt', 'Подтвердите закрытие без начисления:'),
        ...additionalWorkEntityLines({
          idPrefix: 'additional-work-without-accrual',
          employeeFullName: item.employee_full_name,
          additionalWorkName: item.additional_work_name,
        }),
        labeled('additional-work-without-accrual-reason', 'Комментарий', reason!),
      ]);
  const confirmation = card({
    id: accrue ? 'additional-work-accrual-confirmation' : 'additional-work-without-accrual-confirmation',
    rootId: accrue ? SECTION03_POLICY_ROOTS.staticPositiveCard : SECTION03_POLICY_ROOTS.staticNeutralCard,
    lines,
    ariaLabel: accrue ? 'Подтверждение начисления зарплаты' : 'Подтверждение закрытия без начисления',
  });
  const projected = factory(input).business(actionId, {
    instanceId: accrue ? 'additional-work-accrue' : 'additional-work-mark-without-accrual',
    ariaLabel: accrue ? 'Начислить зарплату' : 'Закрыть без начисления',
  }, event);
  if (projected.length !== 1) throw new Section03P3A4ProjectionError(`Runtime denied ${actionId}.`);
  const confirm = actionButton({
    id: accrue ? 'additional-work-accrue' : 'additional-work-mark-without-accrual',
     label: accrue ? 'Начислить зарплату' : 'Закрыть без начисления',
    ariaLabel: accrue ? 'Начислить зарплату' : 'Закрыть без начисления', action: projected[0]!,
  });
  const back = backButton(input, 'navigateBack0', event,
    accrue ? 'additional-work-accrual-confirm-back' : 'additional-work-without-accrual-confirm-back');
  return defineSection03ScreenProjection({
    nodeId: input.nodeId,
    ariaLabel: accrue ? 'Подтверждение начисления зарплаты' : 'Подтверждение закрытия без начисления',
    bridgeProjection: { nodeId: input.nodeId, items: [confirmation, confirm, back] },
    slots: { fixedTop: [], scroll: [confirmation.id], fixedBottom: [confirm.id, back.id] },
  });
}

export function projectSection03P3A4(
  input: P1NodeInput<Section03P3A4SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-AW50': return projectWaitingCard(input as P1NodeInput<'S03-AW50'>);
    case 'S03-AW51': return projectForm(input as P1NodeInput<'S03-AW51'>);
    case 'S03-AW52': return projectConfirmation(input as P1NodeInput<'S03-AW52'>);
    case 'S03-AW53': return projectForm(input as P1NodeInput<'S03-AW53'>);
    case 'S03-AW54': return projectConfirmation(input as P1NodeInput<'S03-AW54'>);
  }
}
