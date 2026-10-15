import type {
  PresentationGraphBridgeItemInput,
  PresentationGraphContentInput,
} from '../../foundation/presentation';
import type {
  PresentationGraphCardLineInput,
  PresentationGraphSecondaryLineInput,
} from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerEmployeeCard,
  ManagerEmployee,
  ManagerEmployees,
} from '../contracts';
import type { Section03NodeId } from '../program';
import {
  defineSection03ScreenProjection,
  normalizeSection03ZonedTimestamp,
  parseSection03DurationMinutes,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  section03EmployeeTuple,
  type Section03ScreenProjection,
} from '../presentation';
import {
  actionButton,
  backButton,
  factory,
  hasAction,
  inert,
  interaction,
  message,
  nodeData,
  primary,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P2A1_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-E01',
  'S03-E02',
  'S03-E12',
] as const satisfies readonly Section03NodeId[]);

export type Section03P2A1SpecializedNodeId =
  typeof SECTION03_P2A1_SPECIALIZED_NODE_IDS[number];

function employeeListModel(
  input: P1NodeInput<'S03-E01'>,
): ManagerEmployees {
  return primary(input) as unknown as ManagerEmployees;
}

function employeeCardModel(
  input: P1NodeInput<'S03-E02' | 'S03-E12'>,
): ManagerEmployeeCard {
  return primary(input) as unknown as ManagerEmployeeCard;
}

function timeOnly(value: string | null): PresentationGraphContentInput | null {
  if (value === null) return null;
  return Object.freeze({
    kind: 'time' as const,
    request: Object.freeze({
      role: 'time-only' as const,
      timestamp: normalizeSection03ZonedTimestamp(value),
    }),
  });
}

function downtimeStart(
  employee: ManagerEmployeeCard['employee'],
): PresentationGraphContentInput | null {
  if (employee.downtime_started_at === null) return null;
  if (employee.downtime_type === null) {
    throw new Error('Employee downtime timestamp requires a downtime type.');
  }
  return Object.freeze({
    kind: 'time' as const,
    request: Object.freeze({
      role: employee.downtime_type === 'critical'
        ? 'date-time-multiline' as const
        : 'time-only' as const,
      timestamp: normalizeSection03ZonedTimestamp(
        employee.downtime_started_at,
      ),
    }),
  });
}

function duration(value: string | null): PresentationGraphContentInput | null {
  if (value === null) return null;
  return Object.freeze({
    kind: 'time' as const,
    request: Object.freeze({
      role: 'elapsed-duration' as const,
      totalMinutes: parseSection03DurationMinutes(value),
    }),
  });
}

function labeled(
  id: string,
  label: string,
  value: PresentationGraphContentInput | null,
): readonly PresentationGraphCardLineInput[] {
  return value === null
    ? Object.freeze([])
    : Object.freeze([Object.freeze({ id, label: text(label), value })]);
}

function contentOnly(
  id: string,
  value: string | null,
): readonly PresentationGraphCardLineInput[] {
  return value === null
    ? Object.freeze([])
    : Object.freeze([Object.freeze({ id, content: text(value) })]);
}

function secondary(
  id: string,
  value: string,
  evidence: unknown,
): PresentationGraphSecondaryLineInput {
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
    employee.active_sku_name === null
      ? null
      : `SKU: ${employee.active_sku_name}`,
    employee.active_machine_name,
    employee.active_break_name,
    employee.active_additional_work_name,
  ].filter((value): value is string => value !== null);
  if (values.length === 0) return undefined;
  const evidence = section03EmployeeTuple(employee);
  return Object.freeze(values.map((value, index) =>
    secondary(`employee-${employee.employee_id}-line-${index}`, value, evidence)));
}

function actionControl(input: Readonly<{
  id: string;
  label: string;
  ariaLabel?: string;
  action: object;
  enabled?: boolean;
}>): PresentationGraphBridgeItemInput {
  return actionButton({
    id: input.id,
    action: input.action,
    label: input.label,
    ariaLabel: input.ariaLabel ?? input.label,
    enabled: input.enabled ?? true,
  });
}

function projectEmployeeList(
  input: P1NodeInput<'S03-E01'>,
): Section03ScreenProjection {
  const model = employeeListModel(input);
  const rows: PresentationGraphBridgeItemInput[] = model.employees.map(
    (employee) => {
      const enabled = hasAction(
        employee.available_actions,
        'OPEN_EMPLOYEE_CARD',
      );
      const id = `employee-${employee.employee_id}`;
      const secondaryLines = employeeSecondaryLines(employee);
      return Object.freeze({
        kind: 'state-list-button' as const,
        id,
        presentationAuthority: section03Authority(
          SECTION03_POLICY_ROOTS.backendEmployeeList,
          section03EmployeeTuple(employee),
        ),
        interaction: enabled
          ? interaction(factory(input).presentation(
              'navigate0',
              {
                instanceId: id,
                ariaLabel: `Открыть карточку сотрудника ${employee.full_name}`,
              },
              { employee_id: employee.employee_id },
            ))
          : inert,
        mainLine: text(employee.full_name),
        ...(secondaryLines === undefined ? {} : { secondaryLines }),
        ariaLabel: enabled
          ? `Открыть карточку сотрудника ${employee.full_name}`
          : `${employee.full_name} — действие недоступно`,
      });
    },
  );
  if (rows.length === 0) {
    rows.push(message('employees-empty', 'Нет сотрудников для отображения.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  }
  const back = backButton(input, 'navigateBack0', {}, 'employees-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-E01',
    ariaLabel: 'Сотрудники',
    fixedTopTitle: 'Сотрудники',
    bridgeProjection: { nodeId: 'S03-E01', items: [...rows, back] },
    slots: {
      fixedTop: [],
      scroll: rows.map((item) => item.id),
      fixedBottom: [back.id],
    },
  });
}

function employeeCardLines(
  employee: ManagerEmployeeCard['employee'],
): readonly PresentationGraphCardLineInput[] {
  const comment = employee.downtime_type === 'critical'
    ? employee.downtime_start_comment ?? employee.downtime_comment
    : null;
  return Object.freeze([
    ...labeled('employee-name', 'Сотрудник', text(employee.full_name)),
    ...labeled('shift-start', 'Время начала смены', timeOnly(employee.shift_started_at)),
    ...labeled('employee-sku', 'SKU', employee.active_sku_name === null ? null : text(employee.active_sku_name)),
    ...labeled('employee-machine', 'Станок', employee.active_machine_name === null ? null : text(employee.active_machine_name)),
    ...contentOnly('employee-downtime', employee.downtime_name),
    ...labeled('downtime-comment', 'Комментарий', comment === null ? null : text(comment)),
    ...labeled('production-start', 'Время начала производства', timeOnly(employee.production_started_at)),
    ...labeled('downtime-start', 'Время начала простоя', downtimeStart(employee)),
    ...labeled('downtime-duration', 'Продолжительность простоя', duration(employee.downtime_duration)),
    ...contentOnly('employee-break', employee.active_break_name),
    ...labeled('break-start', 'Время начала перерыва', timeOnly(employee.break_started_at)),
    ...labeled('break-duration', 'Продолжительность перерыва', duration(employee.break_duration)),
    ...contentOnly('employee-additional-work', employee.active_additional_work_name),
    ...labeled('additional-work-start', 'Время начала доп. работы', timeOnly(employee.additional_work_started_at)),
    ...labeled('additional-work-duration', 'Продолжительность доп. работы', duration(employee.additional_work_duration)),
    ...contentOnly('shift-not-started', employee.ui_state === 'shift_not_started' ? 'Смена не начата' : null),
  ]);
}

function hasBlockers(employee: ManagerEmployeeCard['employee']): boolean {
  return employee.blockers.production !== null ||
    employee.blockers.break !== null ||
    employee.blockers.additional_work !== null;
}

function projectEmployeeCard(
  input: P1NodeInput<'S03-E02'>,
): Section03ScreenProjection {
  const employee = employeeCardModel(input).employee;
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'employee-card',
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendEmployeeCard,
      section03EmployeeTuple(employee),
    ),
    lines: employeeCardLines(employee),
    ariaLabel: employee.full_name,
  });
  const bottom: PresentationGraphBridgeItemInput[] = [];
  bottom.push(actionControl({
    id: 'employee-salary',
    label: 'Зарплата',
    action: factory(input).presentation(
      'navigate3',
      { instanceId: 'employee-salary', ariaLabel: 'Зарплата' },
      { employee_id: employee.employee_id },
    ),
    enabled: hasAction(employee.available_actions, 'VIEW_SALARY'),
  }));
  bottom.push(actionControl({
    id: 'employee-completed-works',
    label: 'Выполненные работы',
    action: factory(input).presentation(
      'navigate2',
      { instanceId: 'employee-completed-works', ariaLabel: 'Выполненные работы' },
      { employee_id: employee.employee_id },
    ),
    enabled: hasAction(employee.available_actions, 'VIEW_COMPLETED_WORKS'),
  }));
  const label = `Завершить смену\n${employee.full_name}`;
  const ariaLabel = `Завершить смену ${employee.full_name}`;
  bottom.push(actionControl({
    id: 'employee-finish-shift',
    label,
    ariaLabel,
    action: factory(input).presentation(
      hasBlockers(employee) ? 'navigate0' : 'navigate1',
      { instanceId: 'employee-finish-shift', ariaLabel },
      { employee_id: employee.employee_id },
    ),
    enabled: hasAction(employee.available_actions, 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER'),
  }));
  bottom.push(backButton(
    input,
    'navigateBack0',
    { employee_id: employee.employee_id },
    'employee-card-back',
  ));
  return defineSection03ScreenProjection({
    nodeId: 'S03-E02',
    ariaLabel: employee.full_name,
    bridgeProjection: { nodeId: 'S03-E02', items: [card, ...bottom] },
    slots: {
      fixedTop: [],
      scroll: [card.id],
      fixedBottom: bottom.map((item) => item.id),
    },
  });
}

function blockerRow(input: Readonly<{
  node: P1NodeInput<'S03-E12'>;
  id: string;
  label: string;
  blocker: 'production' | 'break' | 'additional-work';
  actionId: 'navigate0' | 'navigate1' | 'navigate2';
  event: Readonly<Record<string, string>>;
}>): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'state-list-button' as const,
    id: input.id,
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.derivedBlockerList,
      input.blocker === 'production'
        ? 'production'
        : input.blocker === 'break'
          ? 'break'
          : 'additional-work',
    ),
    interaction: interaction(factory(input.node).presentation(
      input.actionId,
      {
        instanceId: input.id,
        ariaLabel: input.label,
      },
      input.event,
    )),
    mainLine: text(input.label),
    ariaLabel: input.label,
  });
}

function projectBlockers(
  input: P1NodeInput<'S03-E12'>,
): Section03ScreenProjection {
  const employee = employeeCardModel(input).employee;
  const rows: PresentationGraphBridgeItemInput[] = [
    message(
      'employee-blockers-message',
      'Для завершения смены сначала завершите:',
      SECTION03_POLICY_ROOTS.staticInfoMessage,
    ),
  ];
  if (employee.blockers.production !== null) {
    rows.push(blockerRow({
      node: input,
      id: 'blocker-production',
      label: 'Производство',
      blocker: 'production',
      actionId: 'navigate0',
      event: {
        employee_id: employee.employee_id,
        production_operation_id:
          employee.blockers.production.production_operation_id,
      },
    }));
  }
  if (employee.blockers.break !== null) {
    rows.push(blockerRow({
      node: input,
      id: 'blocker-break',
      label: 'Перерыв',
      blocker: 'break',
      actionId: 'navigate1',
      event: { employee_id: employee.employee_id },
    }));
  }
  if (employee.blockers.additional_work !== null) {
    rows.push(blockerRow({
      node: input,
      id: 'blocker-additional-work',
      label: 'Доп. работа',
      blocker: 'additional-work',
      actionId: 'navigate2',
      event: {
        employee_id: employee.employee_id,
        additional_work_id:
          employee.blockers.additional_work.additional_work_id,
      },
    }));
  }
  const back = backButton(
    input,
    'navigateBack0',
    { employee_id: employee.employee_id },
    'employee-blockers-back',
  );
  return defineSection03ScreenProjection({
    nodeId: 'S03-E12',
    ariaLabel: 'Блокирующие процессы смены',
    bridgeProjection: { nodeId: 'S03-E12', items: [...rows, back] },
    slots: {
      fixedTop: [],
      scroll: rows.map((item) => item.id),
      fixedBottom: [back.id],
    },
  });
}

export function projectSection03P2A1(
  input: P1NodeInput<Section03P2A1SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-E01':
      return projectEmployeeList(input as P1NodeInput<'S03-E01'>);
    case 'S03-E02':
      return projectEmployeeCard(input as P1NodeInput<'S03-E02'>);
    case 'S03-E12':
      return projectBlockers(input as P1NodeInput<'S03-E12'>);
  }
}
