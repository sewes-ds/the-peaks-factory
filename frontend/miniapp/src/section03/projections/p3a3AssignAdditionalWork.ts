import type { PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerAdditionalWorkTypesAvailableResponse,
  ManagerEmployees,
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
  factory,
  hasAction,
  inertActionButton,
  interaction,
  message,
  nodeData,
  primary,
  text,
  type P1NodeInput,
} from './common';
import { additionalWorkEntityLines } from './additionalWorkCardLines';

export const SECTION03_P3A3_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-AW40',
  'S03-AW41',
  'S03-AW42',
] as const satisfies readonly Section03NodeId[]);

export type Section03P3A3SpecializedNodeId =
  typeof SECTION03_P3A3_SPECIALIZED_NODE_IDS[number];

export class Section03P3A3ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P3A3ProjectionError';
  }
}

function listRow(input: Readonly<{
  id: string;
  rootId: string;
  mainLine: string;
  secondaryLine?: string;
  action: object | null;
}>): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'state-list-button' as const,
    id: input.id,
    presentationAuthority: section03Authority(input.rootId, null),
    interaction: input.action === null
      ? Object.freeze({ kind: 'inert' as const })
      : interaction(input.action),
    mainLine: text(input.mainLine),
    ...(input.secondaryLine === undefined
      ? {}
      : { secondaryLine: text(input.secondaryLine) }),
    ariaLabel: input.secondaryLine === undefined
      ? input.mainLine
      : `${input.mainLine}. ${input.secondaryLine}`,
  });
}

function projectEmployeeSelection(
  input: P1NodeInput<'S03-AW40'>,
): Section03ScreenProjection {
  const response = primary(input) as unknown as ManagerEmployees;
  const rows: PresentationGraphBridgeItemInput[] = response.employees.map((employee) => {
    const id = `aw-emp-${employee.employee_id}`;
    return Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.staticNeutralList,
        null,
      ),
      mainLine: text(employee.full_name),
      interaction: interaction(factory(input).presentation(
        'navigate0',
        { instanceId: id, ariaLabel: employee.full_name },
        {
          employee_id: employee.employee_id,
          employee_full_name: employee.full_name,
        },
      )),
      ariaLabel: employee.full_name,
    });
  });
  if (rows.length === 0) {
    rows.push(message(
      'assign-employee-empty',
      'Нет сотрудников.',
      SECTION03_POLICY_ROOTS.staticNeutralMessage,
    ));
  }
  const back = backButton(input, 'navigateBack0', {}, 'assign-employee-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-AW40',
    ariaLabel: 'Выберите сотрудника',
    fixedTopTitle: 'Выберите сотрудника',
    bridgeProjection: { nodeId: 'S03-AW40', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((row) => row.id), fixedBottom: [back.id] },
  });
}

function projectWorkTypeSelection(
  input: P1NodeInput<'S03-AW41'>,
): Section03ScreenProjection {
  const response = primary(input) as unknown as ManagerAdditionalWorkTypesAvailableResponse;
  const context = nodeData(input).context;
  const employeeId = context.employee_id;
  const employeeFullName = context.employee_full_name;
  if (employeeId === undefined || employeeFullName === undefined) {
    throw new Section03P3A3ProjectionError('AW41 requires employee display context.');
  }
  if (response.assignability_employee_id !== employeeId) {
    throw new Section03P3A3ProjectionError('AW41 assignability employee mismatch.');
  }
  const rows: PresentationGraphBridgeItemInput[] = response.additional_work_types.map((workType) => {
    const id = `aw-type-${workType.additional_work_type_id}`;
    return listRow({
      id,
      rootId: SECTION03_POLICY_ROOTS.staticNeutralList,
      mainLine: workType.additional_work_name,
      secondaryLine: workType.blocked_message ?? undefined,
      action: workType.can_assign
        ? factory(input).presentation(
            'navigate0',
            { instanceId: id, ariaLabel: workType.additional_work_name },
            {
              employee_id: employeeId,
              employee_full_name: employeeFullName,
              additional_work_type_id: workType.additional_work_type_id,
              additional_work_type_name: workType.additional_work_name,
            },
          )
        : null,
    });
  });
  if (rows.length === 0) {
    rows.push(message(
      'assign-work-type-empty',
      'Нет доступных типов доп. работ.',
      SECTION03_POLICY_ROOTS.staticNeutralMessage,
    ));
  }
  const preservedEmployee = Object.freeze({
    employee_id: employeeId,
    employee_full_name: employeeFullName,
  });
  const back = backButton(input, 'navigateBack0', preservedEmployee, 'assign-work-type-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-AW41',
    ariaLabel: 'Выберите доп. работу',
    fixedTopTitle: 'Выберите доп. работу',
    bridgeProjection: { nodeId: 'S03-AW41', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((row) => row.id), fixedBottom: [back.id] },
  });
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function projectAssignmentConfirmation(
  input: P1NodeInput<'S03-AW42'>,
): Section03ScreenProjection {
  const response = primary(input) as unknown as ManagerAdditionalWorkTypesAvailableResponse;
  const context = nodeData(input).context;
  const employeeId = context.employee_id;
  const employeeFullName = context.employee_full_name;
  const workTypeId = context.additional_work_type_id;
  const workTypeName = context.additional_work_type_name;
  if (employeeId === undefined || employeeFullName === undefined || workTypeId === undefined || workTypeName === undefined) {
    throw new Section03P3A3ProjectionError('AW42 requires four assignment context scalars.');
  }
  if (
    response.assignability_employee_id !== employeeId ||
    response.assignability_additional_work_type_id !== workTypeId
  ) {
    throw new Section03P3A3ProjectionError('AW42 assignability pair mismatch.');
  }
  const selected = response.additional_work_types.find(
    (item) => item.additional_work_type_id === workTypeId,
  );
  if (selected === undefined) {
    throw new Section03P3A3ProjectionError('AW42 selected type is missing from authoritative assignability.');
  }
  const event = Object.freeze({
    employee_id: employeeId,
    employee_full_name: employeeFullName,
    additional_work_type_id: workTypeId,
    additional_work_type_name: workTypeName,
  });
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'assign-additional-work-card',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticNeutralCard, null),
    lines: Object.freeze([
      contentOnly('assign-additional-work-prompt', 'Подтвердите назначение доп. работы:'),
      ...additionalWorkEntityLines({
        idPrefix: 'assign-additional-work',
        employeeFullName,
        additionalWorkName: workTypeName,
      }),
      ...(selected.can_assign ? [] : [contentOnly(
        'assign-additional-work-blocked-reason',
        selected.blocked_message ?? 'Назначение этой доп. работы сейчас недоступно.',
      )]),
    ]),
    ariaLabel: 'Подтверждение назначения доп. работы',
  });
  let confirm: PresentationGraphBridgeItemInput;
  if (selected.can_assign) {
    if (!hasAction(response.available_actions, 'ASSIGN_ADDITIONAL_WORK')) {
      throw new Section03P3A3ProjectionError('AW42 lacks pair assignment authority.');
    }
    const projected = factory(input).business(
      'ASSIGN_ADDITIONAL_WORK',
      { instanceId: 'assign-additional-work', ariaLabel: 'Назначить доп. работу' },
      event,
    );
    if (projected.length !== 1) {
      throw new Section03P3A3ProjectionError('Runtime denied pair assignment authority.');
    }
    confirm = actionButton({
      id: 'assign-additional-work',
      label: 'Назначить доп. работу',
      ariaLabel: 'Назначить доп. работу',
      action: projected[0]!,
    });
  } else {
    confirm = inertActionButton({
      id: 'assign-additional-work',
      label: 'Назначить доп. работу',
      ariaLabel: 'Назначить доп. работу',
      role: 'action-neutral',
    });
  }
  const back = backButton(input, 'navigateBack0', event, 'assign-additional-work-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-AW42',
    ariaLabel: 'Подтверждение назначения доп. работы',
    bridgeProjection: { nodeId: 'S03-AW42', items: [card, confirm, back] },
    slots: {
      fixedTop: [],
      scroll: [card.id],
      fixedBottom: [confirm.id, back.id],
    },
  });
}

export function projectSection03P3A3(
  input: P1NodeInput<Section03P3A3SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-AW40': return projectEmployeeSelection(input as P1NodeInput<'S03-AW40'>);
    case 'S03-AW41': return projectWorkTypeSelection(input as P1NodeInput<'S03-AW41'>);
    case 'S03-AW42': return projectAssignmentConfirmation(input as P1NodeInput<'S03-AW42'>);
  }
}
