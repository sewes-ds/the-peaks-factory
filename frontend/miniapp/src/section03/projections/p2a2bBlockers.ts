import { formatDisplayInteger, type PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type { ManagerEmployeeCard } from '../contracts';
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
  inertActionButton,
  nodeData,
  primary,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P2A2B_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-E13',
  'S03-E14',
  'S03-E16',
  'S03-E17',
] as const satisfies readonly Section03NodeId[]);

export type Section03P2A2bSpecializedNodeId =
  typeof SECTION03_P2A2B_SPECIALIZED_NODE_IDS[number];

function employeeCardModel(
  input: P1NodeInput<Section03P2A2bSpecializedNodeId>,
): ManagerEmployeeCard {
  return primary(input) as unknown as ManagerEmployeeCard;
}

function quantityField(
  input: P1NodeInput<'S03-E13'>,
): PresentationGraphBridgeItemInput {
  if (
    input.formController === undefined ||
    input.formController.fieldIds.length !== 1 ||
    input.formController.fieldIds[0] !== 'quantity_produced'
  ) {
    throw new Error('Missing quantity_produced form controller for S03-E13.');
  }
  return Object.freeze({
    kind: 'form-field' as const,
    id: 'field-quantity_produced',
    controller: input.formController,
    fieldId: 'quantity_produced',
  });
}

function committedQuantity(input: P1NodeInput<'S03-E13'>): string | null {
  if (input.formController?.valid !== true) return null;
  try {
    const value = input.formController.commit().quantity_produced;
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'FORM_PENDING'
    ) return null;
    throw error;
  }
}

function projectQuantityForm(
  input: P1NodeInput<'S03-E13'>,
): Section03ScreenProjection {
  employeeCardModel(input);
  const current = nodeData(input).context;
  const field = quantityField(input);
  const quantity = committedQuantity(input);
  const next = actionButton({
    id: 'production-quantity-next',
     label: 'Далее',
    ariaLabel: 'Далее',
    enabled: quantity !== null,
    action: factory(input).presentation(
      'navigate0',
      { instanceId: 'production-quantity-next', ariaLabel: 'Далее' },
      {
        employee_id: current.employee_id!,
        production_operation_id: current.production_operation_id!,
        ...(quantity === null ? {} : { quantity_produced: quantity }),
      },
    ),
  });
  const back = backButton(input, 'navigateBack0', {
    employee_id: current.employee_id!,
  }, 'production-quantity-back');
  const title = 'Введите количество сделанной продукции';
  return defineSection03ScreenProjection({
    nodeId: 'S03-E13',
    ariaLabel: title,
    fixedTopTitle: title,
    bridgeProjection: { nodeId: 'S03-E13', items: [field, next, back] },
    slots: { fixedTop: [], scroll: [field.id], fixedBottom: [next.id, back.id] },
  });
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function labeled(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function confirmationCard(input: Readonly<{
  id: string;
  blocker: 'production' | 'break' | 'additional-work';
  ariaLabel: string;
  lines: readonly PresentationGraphCardLineInput[];
}>): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'card' as const,
    id: input.id,
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.derivedBlockerCard,
      input.blocker,
    ),
    lines: input.lines,
    ariaLabel: input.ariaLabel,
  });
}

function projectProductionConfirmation(
  input: P1NodeInput<'S03-E14'>,
): Section03ScreenProjection {
  const current = nodeData(input).context;
  const employee = employeeCardModel(input).employee;
  const blocker = employee.blockers.production;
  const lines: PresentationGraphCardLineInput[] = [
    contentOnly('production-finish-prompt', 'Подтвердите завершение производства:'),
    labeled('production-finish-employee', 'Сотрудник', employee.full_name),
  ];
  if (blocker?.machine_name !== null && blocker?.machine_name !== undefined) {
    lines.push(labeled('production-finish-machine', 'Станок', blocker.machine_name));
  }
  if (blocker?.sku_name !== null && blocker?.sku_name !== undefined) {
    lines.push(labeled('production-finish-sku', 'SKU', blocker.sku_name));
  }
  lines.push(labeled('production-finish-quantity', 'Количество', formatDisplayInteger(current.quantity_produced!)));
  const card = confirmationCard({
    id: 'production-finish-card', blocker: 'production',
    ariaLabel: 'Подтверждение завершения производства', lines: Object.freeze(lines),
  });
  const bottom: PresentationGraphBridgeItemInput[] = [];
  const eligible = blocker !== null && blocker.production_operation_id === current.production_operation_id;
  const actions = eligible ? factory(input).business(
      'FINISH_PRODUCTION_BLOCKER',
      { instanceId: `finish-production-${blocker.production_operation_id}`, ariaLabel: 'Завершить производство' },
      {
        employee_id: current.employee_id!,
        production_operation_id: current.production_operation_id!,
        quantity_produced: current.quantity_produced!,
      },
    ) : [];
  bottom.push(actions.length === 1 ? actionButton({
      id: 'production-finish-confirm',       label: 'Завершить производство', ariaLabel: 'Завершить производство', action: actions[0]!,
    }) : inertActionButton({ id: 'production-finish-confirm', label: 'Завершить производство', ariaLabel: 'Завершить производство', role: 'action-positive' }));
  bottom.push(backButton(input, 'navigateBack0', {
    employee_id: current.employee_id!,
    production_operation_id: current.production_operation_id!,
    quantity_produced: current.quantity_produced!,
  }, 'production-finish-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-E14', ariaLabel: 'Подтверждение завершения производства',
    bridgeProjection: { nodeId: 'S03-E14', items: [card, ...bottom] },
    slots: { fixedTop: [], scroll: [card.id], fixedBottom: bottom.map((item) => item.id) },
  });
}

function projectSimpleBlockerConfirmation(
  input: P1NodeInput<'S03-E16'> | P1NodeInput<'S03-E17'>,
): Section03ScreenProjection {
  const current = nodeData(input).context;
  const employee = employeeCardModel(input).employee;
  const isBreak = input.nodeId === 'S03-E16';
  const blocker = isBreak ? employee.blockers.break : employee.blockers.additional_work;
  const identityMatches = isBreak || (
    blocker !== null &&
    'additional_work_id' in blocker &&
    blocker.additional_work_id === current.additional_work_id
  );
  const noun = isBreak ? 'перерыва' : 'доп. работы';
  const label = isBreak ? 'Завершить перерыв' : 'Завершить доп. работу';
  const card = confirmationCard({
    id: isBreak ? 'break-finish-card' : 'additional-work-finish-card',
    blocker: isBreak ? 'break' : 'additional-work',
    ariaLabel: `Подтверждение завершения ${noun}`,
    lines: Object.freeze([
      contentOnly(`${isBreak ? 'break' : 'additional-work'}-finish-prompt`, `Подтвердите завершение ${noun}:`),
      labeled(`${isBreak ? 'break' : 'additional-work'}-finish-employee`, 'Сотрудник', employee.full_name),
    ]),
  });
  const bottom: PresentationGraphBridgeItemInput[] = [];
  const actionId = isBreak ? 'FINISH_BREAK_BLOCKER' : 'FINISH_ADDITIONAL_WORK';
  const event = isBreak
      ? { employee_id: current.employee_id! }
      : { employee_id: current.employee_id!, additional_work_id: current.additional_work_id! };
  const actions = blocker !== null && identityMatches ? factory(input).business(actionId, {
      instanceId: isBreak ? `finish-break-${current.employee_id}` : `finish-additional-work-${current.additional_work_id}`,
      ariaLabel: label,
    }, event) : [];
  bottom.push(actions.length === 1 ? actionButton({
      id: isBreak ? 'break-finish-confirm' : 'additional-work-finish-confirm',
      label, ariaLabel: label, action: actions[0]!,
    }) : inertActionButton({
      id: isBreak ? 'break-finish-confirm' : 'additional-work-finish-confirm',
      label,
      ariaLabel: label,
      role: isBreak ? 'action-warning' : 'action-neutral',
    }));
  const backEvent = isBreak
    ? { employee_id: current.employee_id! }
    : { employee_id: current.employee_id!, additional_work_id: current.additional_work_id! };
  bottom.push(backButton(input, 'navigateBack0', backEvent,
    isBreak ? 'break-finish-back' : 'additional-work-finish-back'));
  return defineSection03ScreenProjection({
    nodeId: input.nodeId,
    ariaLabel: `Подтверждение завершения ${noun}`,
    bridgeProjection: { nodeId: input.nodeId, items: [card, ...bottom] },
    slots: { fixedTop: [], scroll: [card.id], fixedBottom: bottom.map((item) => item.id) },
  });
}

export function projectSection03P2A2b(
  input: P1NodeInput<Section03P2A2bSpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-E13': return projectQuantityForm(input as P1NodeInput<'S03-E13'>);
    case 'S03-E14': return projectProductionConfirmation(input as P1NodeInput<'S03-E14'>);
    case 'S03-E16': return projectSimpleBlockerConfirmation(input as P1NodeInput<'S03-E16'>);
    case 'S03-E17': return projectSimpleBlockerConfirmation(input as P1NodeInput<'S03-E17'>);
  }
}
