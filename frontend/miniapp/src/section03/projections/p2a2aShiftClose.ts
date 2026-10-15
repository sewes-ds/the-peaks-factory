import type { PresentationGraphBridgeItemInput } from '../../foundation/presentation';
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
  hasAction,
  inertActionButton,
  nodeData,
  primary,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P2A2A_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-E10',
  'S03-E11',
] as const satisfies readonly Section03NodeId[]);

export type Section03P2A2aSpecializedNodeId =
  typeof SECTION03_P2A2A_SPECIALIZED_NODE_IDS[number];

function employeeCardModel(
  input: P1NodeInput<Section03P2A2aSpecializedNodeId>,
): ManagerEmployeeCard {
  return primary(input) as unknown as ManagerEmployeeCard;
}

function formField(
  input: P1NodeInput<'S03-E10'>,
): PresentationGraphBridgeItemInput {
  if (
    input.formController === undefined ||
    input.formController.fieldIds.length !== 1 ||
    input.formController.fieldIds[0] !== 'shift_finish_reason'
  ) {
    throw new Error('Missing shift_finish_reason form controller for S03-E10.');
  }
  return Object.freeze({
    kind: 'form-field' as const,
    id: 'field-shift_finish_reason',
    controller: input.formController,
    fieldId: 'shift_finish_reason',
  });
}

function committedReason(input: P1NodeInput<'S03-E10'>): string | null {
  if (input.formController?.valid !== true) return null;
  try {
    const value = input.formController.commit().shift_finish_reason;
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'FORM_PENDING'
    ) {
      return null;
    }
    throw error;
  }
}

function projectShiftCloseReason(
  input: P1NodeInput<'S03-E10'>,
): Section03ScreenProjection {
  employeeCardModel(input);
  const current = nodeData(input).context;
  const field = formField(input);
  const reason = committedReason(input);
  const next = actionButton({
    id: 'shift-close-next',
     label: 'Далее',
    ariaLabel: 'Далее',
    enabled: reason !== null,
    action: factory(input).presentation(
      'navigate0',
      {
        instanceId: 'shift-close-next',
        ariaLabel: 'Далее',
      },
      {
        employee_id: current.employee_id!,
        ...(reason === null ? {} : { shift_finish_reason: reason }),
      },
    ),
  });
  const back = backButton(
    input,
    'navigateBack0',
    { employee_id: current.employee_id! },
    'shift-close-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-E10',
    ariaLabel: 'Комментарий',
    fixedTopTitle: 'Комментарий',
    bridgeProjection: {
      nodeId: 'S03-E10',
      items: [field, next, back],
    },
    slots: {
      fixedTop: [],
      scroll: [field.id],
      fixedBottom: [next.id, back.id],
    },
  });
}

function confirmationLines(
  employee: ManagerEmployeeCard['employee'],
  reason: string,
): readonly PresentationGraphCardLineInput[] {
  return Object.freeze([
    Object.freeze({
      id: 'shift-close-prompt',
      content: text('Подтвердите завершение смены:'),
    }),
    Object.freeze({
      id: 'shift-close-employee',
      label: text('Сотрудник'),
      value: text(employee.full_name),
    }),
    Object.freeze({
      id: 'shift-close-reason',
      label: text('Комментарий'),
      value: text(reason),
    }),
  ]);
}

function projectShiftCloseConfirmation(
  input: P1NodeInput<'S03-E11'>,
): Section03ScreenProjection {
  const current = nodeData(input).context;
  const employee = employeeCardModel(input).employee;
  const reason = current.shift_finish_reason!;
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'shift-close-confirmation',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticDangerCard, null),
    lines: confirmationLines(employee, reason),
    ariaLabel: 'Подтверждение завершения смены',
  });
  const bottom: PresentationGraphBridgeItemInput[] = [];
  const allowed = hasAction(
    employee.available_actions,
    'FINISH_EMPLOYEE_SHIFT_BY_MANAGER',
  );
  const label = `Завершить смену\n${employee.full_name}`;
  const ariaLabel = `Завершить смену ${employee.full_name}`;
  const actions = allowed ? factory(input).business(
      'CLOSE_EMPLOYEE_SHIFT',
      {
        instanceId: `close-employee-shift-${employee.employee_id}`,
        ariaLabel,
      },
      {
        employee_id: current.employee_id!,
        shift_finish_reason: reason,
      },
    ) : [];
  bottom.push(actions.length === 1
    ? actionButton({
        id: 'shift-close-confirm',
        label,
        ariaLabel,
        action: actions[0]!,
      })
    : inertActionButton({ id: 'shift-close-confirm', label, ariaLabel, role: 'action-danger' }));
  bottom.push(backButton(
    input,
    'navigateBack0',
    {
      employee_id: current.employee_id!,
      shift_finish_reason: reason,
    },
    'shift-close-confirmation-back',
  ));
  return defineSection03ScreenProjection({
    nodeId: 'S03-E11',
    ariaLabel: 'Подтверждение завершения смены',
    bridgeProjection: {
      nodeId: 'S03-E11',
      items: [card, ...bottom],
    },
    slots: {
      fixedTop: [],
      scroll: [card.id],
      fixedBottom: bottom.map((item) => item.id),
    },
  });
}

export function projectSection03P2A2a(
  input: P1NodeInput<Section03P2A2aSpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-E10':
      return projectShiftCloseReason(input as P1NodeInput<'S03-E10'>);
    case 'S03-E11':
      return projectShiftCloseConfirmation(input as P1NodeInput<'S03-E11'>);
  }
}
