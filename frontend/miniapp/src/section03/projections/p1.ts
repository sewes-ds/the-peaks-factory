import type {
  PresentationGraphBridgeItemInput,
  PresentationGraphContentInput,
} from '../../foundation/presentation';
import { formatPersonName } from '../../foundation/presentation';
import type { PresentationGraphSecondaryLineInput } from '../../foundation/presentation/graphBridge/model';
import type { ManagerMachine } from '../contracts';
import { SECTION03_AUDIT_REASON } from '../program';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  section03MachineTuple,
  section03DowntimeDurationContent,
  section03DowntimeStartContent,
  type Section03ScreenProjection,
} from '../presentation';
import type { Section03ReadRecord, Section03ReadValue } from '../readModels';
import {
  actionButton,
  array,
  availableActions,
  backButton,
  bool,
  cardLine,
  context,
  factory,
  hasAction,
  inert,
  inertActionButton,
  interaction,
  message,
  nodeData,
  optionalText,
  primary,
  readyProjection,
  record,
  requiredText,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P1_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-N01',
  'S03-M01',
  'S03-M02',
  'S03-M03O',
  'S03-M03C',
  'S03-M04C',
  'S03-D01',
  'S03-D10',
  'S03-D11',
  'S03-D12',
  'S03-D13',
] as const satisfies readonly Section03NodeId[]);

export type Section03P1SpecializedNodeId = typeof SECTION03_P1_SPECIALIZED_NODE_IDS[number];

function secondary(
  id: string,
  value: string,
  rootId: string,
  evidence: unknown,
): PresentationGraphSecondaryLineInput {
  return Object.freeze({
    id,
    presentationAuthority: section03Authority(rootId, evidence),
    content: text(value),
  });
}

function secondaryContent(
  id: string,
  content: PresentationGraphContentInput,
  rootId: string,
  evidence: unknown,
): PresentationGraphSecondaryLineInput {
  return Object.freeze({
    id,
    presentationAuthority: section03Authority(rootId, evidence),
    content,
  });
}

function mainTile(input: Readonly<{
  node: P1NodeInput<'S03-N01'>;
  id: string;
  title: string;
  ariaLabel: string;
  actionId: string;
  authority: string;
  available: readonly string[];
  tile: 'machines' | 'employees' | 'downtimes' | 'additional-works' | 'corrections' | 'notifications' | 'reports';
  lines?: readonly PresentationGraphSecondaryLineInput[];
}>): PresentationGraphBridgeItemInput {
  const available = hasAction(input.available, input.authority);
  return Object.freeze({
    kind: 'state-list-button' as const,
    id: input.id,
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.derivedMainTile,
      input.tile,
    ),
    interaction: available
      ? interaction(factory(input.node).presentation(
          input.actionId,
          { instanceId: input.id, ariaLabel: input.ariaLabel },
          {},
        ))
      : inert,
    mainLine: text(input.title),
    ...(input.lines === undefined ? {} : { secondaryLines: input.lines }),
    ariaLabel: available
      ? input.ariaLabel
      : `${input.title} — действие недоступно`,
  });
}

function projectMain(input: P1NodeInput<'S03-N01'>): Section03ScreenProjection {
  const current = readyProjection(input);
  if (current.kind !== 'manager-main') throw new Error('S03-N01 requires manager-main projection.');
  const sections = current.model.sections;
  const items = Object.freeze([
    mainTile({ node: input, id: 'main-machines', title: 'Станки', ariaLabel: 'Открыть раздел Станки', actionId: 'openMachines', authority: 'OPEN_MACHINES', available: sections.machines.available_actions, tile: 'machines', lines: Object.freeze([
      secondary('machines-running', `Работают: ${sections.machines.running_count}`, SECTION03_POLICY_ROOTS.derivedCountSummary, { count: sections.machines.running_count, baseline: 'info', positive: 'positive' }),
      secondary('machines-downtime', `Простои: ${sections.machines.downtime_count}`, SECTION03_POLICY_ROOTS.derivedSeveritySummary, { count: sections.machines.downtime_count, severity: sections.machines.downtime_severity }),
      secondary('machines-idle', `Не работают: ${sections.machines.idle_count}`, SECTION03_POLICY_ROOTS.staticInfoSummary, null),
    ]) }),
    mainTile({ node: input, id: 'main-employees', title: 'Сотрудники', ariaLabel: 'Открыть раздел Сотрудники', actionId: 'p1OpenEmployees', authority: 'OPEN_EMPLOYEES', available: sections.employees.available_actions, tile: 'employees', lines: Object.freeze([
      secondary('employees-open-shift', `Смена открыта: ${sections.employees.open_shift_count}`, SECTION03_POLICY_ROOTS.staticInfoSummary, null),
      secondary('employees-production', `Производство: ${sections.employees.production_count}`, SECTION03_POLICY_ROOTS.derivedCountSummary, { count: sections.employees.production_count, baseline: 'info', positive: 'positive' }),
      secondary('employees-downtime', `Простой: ${sections.employees.downtime_count}`, SECTION03_POLICY_ROOTS.derivedSeveritySummary, { count: sections.employees.downtime_count, severity: sections.employees.production_downtime_severity }),
      secondary('employees-additional-work', `Доп. работы: ${sections.employees.additional_work_count}`, SECTION03_POLICY_ROOTS.staticInfoSummary, null),
      secondary('employees-break', `Перерыв: ${sections.employees.break_count}`, SECTION03_POLICY_ROOTS.derivedCountSummary, { count: sections.employees.break_count, baseline: 'info', positive: 'warning' }),
      secondary('employees-without-work', `Без работы: ${sections.employees.without_work_count}`, SECTION03_POLICY_ROOTS.staticInfoSummary, null),
    ]) }),
    mainTile({ node: input, id: 'main-downtimes', title: 'Простои', ariaLabel: 'Открыть раздел Простои', actionId: 'p1OpenDowntimes', authority: 'OPEN_DOWNTIMES', available: sections.downtimes.available_actions, tile: 'downtimes', lines: Object.freeze([
      secondary('downtimes-critical', `Критический: ${sections.downtimes.critical_count}`, SECTION03_POLICY_ROOTS.derivedCountSummary, { count: sections.downtimes.critical_count, baseline: 'info', positive: 'danger' }),
      secondary('downtimes-operational', `Операционный: ${sections.downtimes.operational_count}`, SECTION03_POLICY_ROOTS.derivedCountSummary, { count: sections.downtimes.operational_count, baseline: 'info', positive: 'warning' }),
    ]) }),
    mainTile({ node: input, id: 'main-additional-works', title: 'Доп. работы', ariaLabel: 'Открыть раздел Доп. работы', actionId: 'p1OpenAdditionalWorks', authority: 'OPEN_ADDITIONAL_WORKS', available: sections.additional_works.available_actions, tile: 'additional-works', lines: Object.freeze([
      secondary('additional-works-requested', `Запрошено: ${sections.additional_works.requested_count}`, SECTION03_POLICY_ROOTS.staticNeutralSummary, null),
      secondary('additional-works-approved', `Согласовано: ${sections.additional_works.approved_count}`, SECTION03_POLICY_ROOTS.staticNeutralSummary, null),
      secondary('additional-works-active', `В работе: ${sections.additional_works.active_count}`, SECTION03_POLICY_ROOTS.derivedCountSummary, { count: sections.additional_works.active_count, baseline: 'neutral', positive: 'positive' }),
      secondary('additional-works-requires-accrual', `Требуют начисления: ${sections.additional_works.requires_accrual_count}`, SECTION03_POLICY_ROOTS.derivedCountSummary, { count: sections.additional_works.requires_accrual_count, baseline: 'neutral', positive: 'positive' }),
    ]) }),
    mainTile({ node: input, id: 'main-corrections', title: 'Корректировки', ariaLabel: 'Открыть раздел Корректировки', actionId: 'p1OpenCorrections', authority: 'OPEN_CORRECTIONS', available: sections.corrections.available_actions, tile: 'corrections' }),
    mainTile({ node: input, id: 'main-notifications', title: 'Уведомления', ariaLabel: 'Открыть раздел Уведомления', actionId: 'p1OpenNotifications', authority: 'OPEN_NOTIFICATIONS', available: sections.notifications.available_actions, tile: 'notifications', lines: Object.freeze([
      secondary('notifications-open-tasks', `Открытые задачи: ${sections.notifications.open_tasks_count}`, SECTION03_POLICY_ROOTS.staticInfoSummary, null),
    ]) }),
    mainTile({ node: input, id: 'main-reports', title: 'Отчёты', ariaLabel: 'Открыть раздел Отчёты', actionId: 'p1OpenReports', authority: 'OPEN_REPORTS', available: sections.reports.available_actions, tile: 'reports' }),
  ]);
  return defineSection03ScreenProjection({
    nodeId: 'S03-N01',
    ariaLabel: 'Рабочее место начальника производства',
    bridgeProjection: { nodeId: 'S03-N01', items },
    slots: { fixedTop: [], scroll: items.map((item) => item.id), fixedBottom: [] },
  });
}

function machineFromRecord(value: Section03ReadValue, path: string): ManagerMachine {
  const item = record(value, path);
  const nullable = (field: string) => optionalText(item[field]);
  const type = nullable('downtime_type');
  if (type !== null && type !== 'operational' && type !== 'critical') throw new Error(`Invalid downtime type at ${path}.`);
  const state = requiredText(item.ui_state, `${path}.ui_state`);
  const variant = requiredText(item.ui_variant, `${path}.ui_variant`);
  return Object.freeze({
    machine_id: requiredText(item.machine_id, `${path}.machine_id`),
    machine_name: requiredText(item.machine_name, `${path}.machine_name`),
    ui_state: state as ManagerMachine['ui_state'],
    ui_variant: variant as ManagerMachine['ui_variant'],
    active_production_operation_id: nullable('active_production_operation_id'),
    active_employee_id: nullable('active_employee_id'),
    active_employee_full_name: nullable('active_employee_full_name'),
    active_sku_id: nullable('active_sku_id'),
    active_sku_code: nullable('active_sku_code'),
    active_sku_name: nullable('active_sku_name'),
    active_break_id: nullable('active_break_id'),
    active_break_name: nullable('active_break_name'),
    active_downtime_id: nullable('active_downtime_id'),
    downtime_type: type,
    downtime_name: nullable('downtime_name'),
    downtime_comment: nullable('downtime_comment'),
    downtime_start_comment: nullable('downtime_start_comment'),
    downtime_finish_comment: nullable('downtime_finish_comment'),
    downtime_started_at: nullable('downtime_started_at'),
    downtime_duration: nullable('downtime_duration'),
    has_active_critical_downtime: bool(item.has_active_critical_downtime),
    has_active_operational_downtime: bool(item.has_active_operational_downtime),
    active_operational_downtime_id: nullable('active_operational_downtime_id'),
    is_selectable_for_manager_critical_downtime: bool(item.is_selectable_for_manager_critical_downtime),
    available_actions: availableActions(item.available_actions),
  });
}

function machineRows(input: P1NodeInput<'S03-M01'>): readonly ManagerMachine[] {
  const current = readyProjection(input);
  if (current.kind !== 'machine-list') throw new Error('S03-M01 requires machine-list projection.');
  return current.model.machines;
}

function machineModel(input: P1NodeInput<'S03-M02' | 'S03-M03O'>): ManagerMachine {
  const current = readyProjection(input);
  if (current.kind === 'machine-card' || current.kind === 'operational-downtime-confirmation') return current.model.machine;
  throw new Error(`${input.nodeId} requires machine card data.`);
}

function loadedMachine(input: P1NodeInput): ManagerMachine {
  const source = primary(input);
  return machineFromRecord(record(source.machine, '$.machine') as Section03ReadValue, '$.machine');
}

function machineSecondary(machine: ManagerMachine): string | null {
  if (machine.ui_state !== 'running') return null;
  const lines = [
    machine.active_sku_name === null ? null : `SKU: ${machine.active_sku_name}`,
    machine.active_employee_full_name === null ? null : formatPersonName(machine.active_employee_full_name),
  ]
    .filter((value): value is string => value !== null);
  return lines.length === 0 ? null : lines.join('\n');
}

function machineActionId(state: ManagerMachine['ui_state']): 'openMachineRunning' | 'openMachineWarning' | 'openMachineCritical' | 'openMachineIdle' {
  if (state === 'running') return 'openMachineRunning';
  if (state === 'warning') return 'openMachineWarning';
  if (state === 'critical') return 'openMachineCritical';
  return 'openMachineIdle';
}

function projectMachines(input: P1NodeInput<'S03-M01'>): Section03ScreenProjection {
  const rows: PresentationGraphBridgeItemInput[] = [];
  for (const machine of machineRows(input)) {
    const id = `machine-${machine.machine_id}`;
    const available = hasAction(machine.available_actions, 'OPEN_MACHINE_CARD');
    const secondaryLine = machineSecondary(machine);
    rows.push(Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.backendMachineList,
        section03MachineTuple(machine),
      ),
      interaction: available ? interaction(factory(input).presentation(
        machineActionId(machine.ui_state),
        { instanceId: id, ariaLabel: `Открыть карточку станка ${machine.machine_name}` },
        { machine_id: machine.machine_id },
      )) : inert,
      mainLine: text(machine.machine_name),
      ...(secondaryLine === null ? {} : { secondaryLine: text(secondaryLine) }),
      ariaLabel: available ? `Открыть карточку станка ${machine.machine_name}` : `${machine.machine_name} — действие недоступно`,
    }));
  }
  if (rows.length === 0) rows.push(message('machines-empty', 'Нет станков для отображения.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = backButton(input, 'p1BackToMain', {}, 'machines-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-M01', ariaLabel: 'Станки', fixedTopTitle: 'Станки',
    bridgeProjection: { nodeId: 'S03-M01', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((item) => item.id), fixedBottom: [back.id] },
  });
}

function machineCardItem(machine: ManagerMachine, id = 'machine-card'): PresentationGraphBridgeItemInput {
  const hasDowntime = machine.active_downtime_id !== null;
  const hasProduction = machine.active_production_operation_id !== null || machine.ui_state === 'running';
  const criticalComment = machine.downtime_start_comment ?? machine.downtime_comment;
  const lines = hasDowntime ? Object.freeze([
    ...cardLine(`${id}-machine`, 'Станок', text(machine.machine_name)),
    ...cardLine(`${id}-sku`, 'SKU', machine.active_sku_name === null ? null : text(machine.active_sku_name)),
    ...cardLine(`${id}-employee`, 'Сотрудник', machine.active_employee_full_name === null ? null : text(machine.active_employee_full_name)),
    ...cardLine(`${id}-downtime-reason`, 'Причина простоя', machine.downtime_name === null ? null : text(machine.downtime_name)),
    ...cardLine(`${id}-comment`, 'Комментарий', machine.downtime_type === 'critical' && criticalComment !== null && criticalComment !== undefined ? text(criticalComment) : null),
    ...cardLine(`${id}-start`, 'Время начала простоя', section03DowntimeStartContent(machine)),
    ...cardLine(`${id}-duration`, 'Длительность простоя', section03DowntimeDurationContent(machine)),
  ]) : hasProduction ? Object.freeze([
    ...cardLine(`${id}-machine`, 'Станок', text(machine.machine_name)),
    ...cardLine(`${id}-sku`, 'SKU', machine.active_sku_name === null ? null : text(machine.active_sku_name)),
    ...cardLine(`${id}-employee`, 'Сотрудник', machine.active_employee_full_name === null ? null : text(machine.active_employee_full_name)),
  ]) : Object.freeze([...cardLine(`${id}-machine`, 'Станок', text(machine.machine_name))]);
  return Object.freeze({
    kind: 'card' as const,
    id,
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendMachineCard,
      section03MachineTuple(machine),
    ),
    lines,
    ariaLabel: machine.machine_name,
  });
}

function confirmationCard(machine: ManagerMachine, id: string, rootId: string, comment?: string): PresentationGraphBridgeItemInput {
  const lines = Object.freeze([
    ...cardLine(`${id}-machine`, 'Станок', text(machine.machine_name)),
    ...cardLine(`${id}-sku`, 'SKU', machine.active_sku_name === null ? null : text(machine.active_sku_name)),
    ...cardLine(`${id}-employee`, 'Сотрудник', machine.active_employee_full_name === null ? null : text(machine.active_employee_full_name)),
    ...cardLine(`${id}-reason`, 'Причина простоя', machine.downtime_name === null ? null : text(machine.downtime_name)),
    ...(comment === undefined ? [] : cardLine(`${id}-comment`, 'Комментарий', text(comment))),
  ]);
  return Object.freeze({
    kind: 'card' as const,
    id,
    presentationAuthority: section03Authority(rootId, null),
    lines,
    ariaLabel: machine.machine_name,
  });
}

function projectMachineCard(input: P1NodeInput<'S03-M02'>): Section03ScreenProjection {
  const machine = machineModel(input);
  const scroll = [machineCardItem(machine)];
  const bottom: PresentationGraphBridgeItemInput[] = [];
  if (machine.active_downtime_id !== null && machine.downtime_type === 'operational') {
    const downtimeName = machine.downtime_name ?? 'простой';
    const label = `Завершить:\n${downtimeName}`;
    const ariaLabel = `Завершить: ${downtimeName}`;
    bottom.push(actionButton({ id: `machine-finish-operational-${machine.active_downtime_id}`, label, ariaLabel, action: factory(input).presentation(
      'openOperationalDowntimeFinish',
      { instanceId: `machine-finish-operational-${machine.active_downtime_id}`, ariaLabel },
      { machine_id: machine.machine_id, downtime_id: machine.active_downtime_id },
    ), enabled: hasAction(machine.available_actions, 'FINISH_DOWNTIME') }));
  } else if (machine.active_downtime_id !== null && machine.downtime_type === 'critical') {
    const downtimeName = machine.downtime_name ?? 'простой';
    const label = `Завершить:\n${downtimeName}`;
    const ariaLabel = `Завершить: ${downtimeName}`;
    bottom.push(actionButton({ id: `machine-finish-critical-${machine.active_downtime_id}`, label, ariaLabel, action: factory(input).presentation(
      'p1OpenCriticalFinish',
      { instanceId: `machine-finish-critical-${machine.active_downtime_id}`, ariaLabel },
      { machine_id: machine.machine_id, downtime_id: machine.active_downtime_id },
    ), enabled: hasAction(machine.available_actions, 'FINISH_DOWNTIME') }));
  } else {
    bottom.push(actionButton({ id: `machine-start-downtime-${machine.machine_id}`, label: 'Начать простой', ariaLabel: 'Начать простой', action: factory(input).presentation(
      'p1OpenDowntimeStart',
      { instanceId: `machine-start-downtime-${machine.machine_id}`, ariaLabel: 'Начать простой' },
      { machine_id: machine.machine_id },
    ), enabled: machine.active_downtime_id === null && hasAction(machine.available_actions, 'START_CRITICAL_DOWNTIME') }));
  }
  bottom.push(backButton(input, 'p1BackToMachineList', {}, 'machine-card-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-M02', ariaLabel: machine.machine_name,
    bridgeProjection: { nodeId: 'S03-M02', items: [...scroll, ...bottom] },
    slots: { fixedTop: [], scroll: scroll.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}

function projectOperationalFinish(input: P1NodeInput<'S03-M03O'>): Section03ScreenProjection {
  const machine = machineModel(input);
  const current = context(input);
  const scroll = [
    message(
      'operational-finish-message',
      'Подтвердите завершение простоя',
      SECTION03_POLICY_ROOTS.staticWarningMessage,
    ),
    confirmationCard(machine, 'operational-finish-card', SECTION03_POLICY_ROOTS.staticWarningCard),
  ];
  const bottom: PresentationGraphBridgeItemInput[] = [];
  const downtimeId = current.downtime_id ?? machine.active_downtime_id;
  const downtimeName = machine.downtime_name ?? 'простой';
  const label = `Завершить:\n${downtimeName}`;
  const ariaLabel = `Завершить: ${downtimeName}`;
  const actionInstanceId = `finish-operational-${downtimeId ?? 'unavailable'}`;
  const eligible = downtimeId !== null && downtimeId !== undefined &&
    machine.downtime_type === 'operational' &&
    hasAction(machine.available_actions, 'FINISH_DOWNTIME');
  const projected = eligible ? factory(input).business('FINISH_DOWNTIME', { instanceId: actionInstanceId, ariaLabel }, {
      ...current, machine_id: machine.machine_id, downtime_id: downtimeId, comment_finish: SECTION03_AUDIT_REASON,
    }) : [];
  bottom.push(projected.length === 1
    ? actionButton({ id: actionInstanceId, label, ariaLabel, action: projected[0]! })
    : inertActionButton({ id: actionInstanceId, label, ariaLabel, role: 'action-warning' }));
  bottom.push(backButton(input, 'p1BackToMachineCard', {
    machine_id: machine.machine_id,
  }, 'operational-finish-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-M03O', ariaLabel: 'Подтвердите завершение простоя',
    bridgeProjection: { nodeId: 'S03-M03O', items: [...scroll, ...bottom] },
    slots: { fixedTop: [], scroll: scroll.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}

function formField(input: P1NodeInput, fieldId: string): PresentationGraphBridgeItemInput {
  if (input.formController === undefined || input.formController.fieldIds[0] !== fieldId) {
    throw new Error(`Missing ${fieldId} form controller for ${input.nodeId}.`);
  }
  return Object.freeze({ kind: 'form-field' as const, id: `field-${fieldId}`, controller: input.formController, fieldId });
}

function commitValidForm(input: P1NodeInput): Readonly<Record<string, string>> {
  if (input.formController?.valid !== true) return Object.freeze({});
  try {
    return input.formController.commit();
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'FORM_PENDING') {
      return Object.freeze({});
    }
    throw error;
  }
}

function projectCriticalFinishComment(input: P1NodeInput<'S03-M03C'>): Section03ScreenProjection {
  const current = nodeData(input).context;
  const field = formField(input, 'comment_finish');
  const valid = input.formController?.valid === true;
  const committed = commitValidForm(input);
  const next = actionButton({
    id: 'critical-finish-next', label: 'Далее', ariaLabel: 'Далее', enabled: valid,
    action: factory(input).presentation('p1ContinueCriticalFinish', { instanceId: 'critical-finish-next', ariaLabel: 'Далее' }, {
      machine_id: current.machine_id!, downtime_id: current.downtime_id!,
      ...(typeof committed.comment_finish === 'string' ? { comment_finish: committed.comment_finish } : {}),
    }),
  });
  const back = backButton(input, 'p1BackToMachineCard', {
    machine_id: current.machine_id!, downtime_id: current.downtime_id!,
  }, 'critical-finish-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-M03C', ariaLabel: 'Комментарий', fixedTopTitle: 'Комментарий',
    bridgeProjection: { nodeId: 'S03-M03C', items: [field, next, back] },
    slots: { fixedTop: [], scroll: [field.id], fixedBottom: [next.id, back.id] },
  });
}

function projectCriticalFinishConfirm(input: P1NodeInput<'S03-M04C'>): Section03ScreenProjection {
  const current = nodeData(input).context;
  const machine = loadedMachine(input);
  const comment = current.comment_finish!;
  const scroll = [
    message(
      'critical-finish-message',
      'Подтвердите завершение простоя',
      SECTION03_POLICY_ROOTS.staticDangerMessage,
    ),
    confirmationCard(machine, 'critical-finish-card', SECTION03_POLICY_ROOTS.staticDangerCard, comment),
  ];
  const bottom: PresentationGraphBridgeItemInput[] = [];
  const downtimeName = machine.downtime_name ?? 'простой';
  const label = `Завершить:\n${downtimeName}`;
  const ariaLabel = `Завершить: ${downtimeName}`;
  const projected = factory(input).business('FINISH_DOWNTIME', { instanceId: `finish-critical-${current.downtime_id}`, ariaLabel }, current);
  bottom.push(projected.length === 1
    ? actionButton({ id: `finish-critical-${current.downtime_id}`, label, ariaLabel, action: projected[0]! })
    : inertActionButton({ id: `finish-critical-${current.downtime_id}`, label, ariaLabel, role: 'action-danger' }));
  bottom.push(backButton(input, 'p1BackToCriticalFinishForm', {
    machine_id: current.machine_id!, downtime_id: current.downtime_id!,
  }, 'critical-finish-confirm-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-M04C', ariaLabel: 'Подтвердите завершение простоя',
    bridgeProjection: { nodeId: 'S03-M04C', items: [...scroll, ...bottom] },
    slots: { fixedTop: [], scroll: scroll.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}

function machineTupleFromRecord(
  item: Section03ReadRecord,
  path: string,
) {
  return Object.freeze({
    family: 'machine' as const,
    tuple: Object.freeze({
      ui_state: requiredText(item.ui_state, `${path}.ui_state`),
      ui_variant: requiredText(item.ui_variant, `${path}.ui_variant`),
    }),
  });
}

function downtimeSecondaryLines(
  item: Section03ReadRecord,
  id: string,
  evidence: unknown,
): readonly PresentationGraphSecondaryLineInput[] {
  const duration = section03DowntimeDurationContent({ downtime_duration: optionalText(item.downtime_duration) });
  if (duration === null) {
    throw new Error('S03-D01 downtime summary requires downtime_duration.');
  }
  return Object.freeze([
    secondary(`${id}-machine`, requiredText(item.machine_name, '$.machine_name'), SECTION03_POLICY_ROOTS.backendMachineSummary, evidence),
    secondaryContent(`${id}-duration`, duration, SECTION03_POLICY_ROOTS.backendMachineSummary, evidence),
  ]);
}

function projectDowntimes(input: P1NodeInput<'S03-D01'>): Section03ScreenProjection {
  const source = primary(input);
  const rows: PresentationGraphBridgeItemInput[] = [];
  for (const [index, value] of array(source.downtimes, '$.downtimes').entries()) {
    const item = record(value, `$.downtimes[${index}]`);
    const machineId = requiredText(item.machine_id, `$.downtimes[${index}].machine_id`);
    const downtimeId = requiredText(item.active_downtime_id ?? item.downtime_id, `$.downtimes[${index}].active_downtime_id`);
    requiredText(item.downtime_type, `$.downtimes[${index}].downtime_type`);
    const id = `downtime-${downtimeId}`;
    const allowed = hasAction(availableActions(item.available_actions), 'OPEN_MACHINE_CARD');
    const evidence = machineTupleFromRecord(item, `$.downtimes[${index}]`);
    rows.push(Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.backendMachineList,
        evidence,
      ),
      interaction: allowed ? interaction(factory(input).presentation('p1OpenDowntimeMachine', { instanceId: id, ariaLabel: `Открыть ${requiredText(item.machine_name, '$.machine_name')}` }, { machine_id: machineId })) : inert,
      mainLine: text(requiredText(item.downtime_name, '$.downtime_name')),
      secondaryLines: downtimeSecondaryLines(item, id, evidence),
      ariaLabel: allowed ? `Открыть ${requiredText(item.machine_name, '$.machine_name')}` : 'Действие недоступно',
    }));
  }
  if (rows.length === 0) rows.push(message('downtimes-empty', 'Нет открытых простоев.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const bottom: PresentationGraphBridgeItemInput[] = [];
  bottom.push(actionButton({
    id: 'downtimes-start',
    label: 'Начать простой',
    ariaLabel: 'Начать простой',
    action: factory(input).presentation('p1OpenDowntimeStart', { instanceId: 'downtimes-start', ariaLabel: 'Начать простой' }, {}),
    enabled: hasAction(availableActions(source.available_actions), 'START_CRITICAL_DOWNTIME'),
  }));
  bottom.push(backButton(input, 'p1BackToMain', {}, 'downtimes-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-D01', ariaLabel: 'Простои', fixedTopTitle: 'Простои',
    bridgeProjection: { nodeId: 'S03-D01', items: [...rows, ...bottom] },
    slots: { fixedTop: [], scroll: rows.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}

function projectDowntimeTypes(input: P1NodeInput<'S03-D10'>): Section03ScreenProjection {
  const source = primary(input);
  const current = nodeData(input).context;
  const rows: PresentationGraphBridgeItemInput[] = [];
  for (const [index, value] of array(source.downtime_types, '$.downtime_types').entries()) {
    const item = record(value, `$.downtime_types[${index}]`);
    const typeId = requiredText(item.downtime_type_id, `$.downtime_types[${index}].downtime_type_id`);
    const name = requiredText(item.downtime_type_name, `$.downtime_types[${index}].downtime_type_name`);
    const id = `downtime-type-${typeId}`;
    const withMachine = current.machine_id !== undefined;
    rows.push(Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticDangerList, null),
      interaction: interaction(factory(input).presentation(withMachine ? 'p1SelectDowntimeTypeWithMachine' : 'p1SelectDowntimeTypeWithoutMachine', { instanceId: id, ariaLabel: name }, {
        ...current, downtime_type_id: typeId, downtime_type_name: name,
      })),
      mainLine: text(name), ariaLabel: name,
    }));
  }
  if (rows.length === 0) rows.push(message('downtime-types-empty', 'Нет доступных критических простоев.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = current.machine_id === undefined
    ? backButton(input, 'p1BackToDowntimeList', {}, 'downtime-types-back')
    : backButton(input, 'p1BackToMachineCard', { machine_id: current.machine_id }, 'downtime-types-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-D10', ariaLabel: 'Выберите тип простоя', fixedTopTitle: 'Выберите тип простоя',
    bridgeProjection: { nodeId: 'S03-D10', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((item) => item.id), fixedBottom: [back.id] },
  });
}

function projectDowntimeMachines(input: P1NodeInput<'S03-D11'>): Section03ScreenProjection {
  const source = primary(input);
  const current = nodeData(input).context;
  const rows: PresentationGraphBridgeItemInput[] = [];
  for (const [index, value] of array(source.machines, '$.machines').entries()) {
    const machine = machineFromRecord(value, `$.machines[${index}]`);
    const id = `downtime-machine-${machine.machine_id}`;
    const conflict = machine.has_active_operational_downtime && machine.active_operational_downtime_id !== null;
    const event: Section03Context = conflict ? {
      ...current,
      machine_id: machine.machine_id,
      downtime_id: machine.active_operational_downtime_id!,
      downtime_follow_up: 'start_critical_downtime',
    } : { ...current, machine_id: machine.machine_id };
    rows.push(Object.freeze({
      kind: 'state-list-button' as const,
      id,
      presentationAuthority: section03Authority(
        SECTION03_POLICY_ROOTS.backendMachineList,
        section03MachineTuple(machine),
      ),
      interaction: interaction(
        factory(input).presentation(conflict ? 'p1SelectDowntimeMachineConflict' : 'p1SelectDowntimeMachine', { instanceId: id, ariaLabel: machine.machine_name }, event),
        !machine.has_active_critical_downtime,
      ),
      mainLine: text(machine.machine_name),
      ariaLabel: machine.has_active_critical_downtime ? `${machine.machine_name} — действие недоступно` : machine.machine_name,
    }));
  }
  if (rows.length === 0) rows.push(message('downtime-machines-empty', 'Нет доступных станков.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = backButton(input, 'p1BackToDowntimeTypes', {
    downtime_type_id: current.downtime_type_id!, downtime_type_name: current.downtime_type_name!,
  }, 'downtime-machines-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-D11', ariaLabel: 'Выберите станок', fixedTopTitle: 'Выберите станок',
    bridgeProjection: { nodeId: 'S03-D11', items: [...rows, back] },
    slots: { fixedTop: [], scroll: rows.map((item) => item.id), fixedBottom: [back.id] },
  });
}

function projectDowntimeComment(input: P1NodeInput<'S03-D12'>): Section03ScreenProjection {
  const current = nodeData(input).context;
  const field = formField(input, 'comment_start');
  const valid = input.formController?.valid === true;
  const committed = commitValidForm(input);
  const next = actionButton({
    id: 'downtime-comment-next', label: 'Далее', ariaLabel: 'Далее', enabled: valid,
    action: factory(input).presentation('p1ContinueDowntimeStart', { instanceId: 'downtime-comment-next', ariaLabel: 'Далее' }, {
      machine_id: current.machine_id!, downtime_type_id: current.downtime_type_id!, downtime_type_name: current.downtime_type_name!,
      ...(typeof committed.comment_start === 'string' ? { comment_start: committed.comment_start } : {}),
    }),
  });
  const back = backButton(input, 'p1BackToDowntimeMachines', {
    machine_id: current.machine_id!, downtime_type_id: current.downtime_type_id!, downtime_type_name: current.downtime_type_name!,
  }, 'downtime-comment-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-D12', ariaLabel: 'Комментарий', fixedTopTitle: 'Комментарий',
    bridgeProjection: { nodeId: 'S03-D12', items: [field, next, back] },
    slots: { fixedTop: [], scroll: [field.id], fixedBottom: [next.id, back.id] },
  });
}

function projectDowntimeStartConfirm(input: P1NodeInput<'S03-D13'>): Section03ScreenProjection {
  const current = nodeData(input).context;
  const machine = loadedMachine(input);
  const lines = Object.freeze([
    ...cardLine('downtime-start-type', 'Тип простоя', text(current.downtime_type_name!)),
    ...cardLine('downtime-start-machine', 'Станок', text(machine.machine_name)),
    ...cardLine('downtime-start-comment', 'Комментарий', text(current.comment_start!)),
  ]);
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'downtime-start-card',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticDangerCard, null),
    lines,
    ariaLabel: 'Подтверждение начала простоя',
  });
  const scroll = [message(
    'downtime-start-message',
    'Подтвердите начало простоя:',
    SECTION03_POLICY_ROOTS.staticDangerMessage,
  ), card];
  const bottom: PresentationGraphBridgeItemInput[] = [];
  const downtimeName = current.downtime_type_name ?? 'простой';
  const label = `Начать:\n${downtimeName}`;
  const ariaLabel = `Начать: ${downtimeName}`;
  const projected = factory(input).business('START_CRITICAL_DOWNTIME', { instanceId: 'downtime-start-confirm', ariaLabel }, {
    ...current,
    ...(machine.active_production_operation_id === null
      ? {}
      : { production_operation_id: machine.active_production_operation_id }),
  } as Section03Context);
  bottom.push(projected.length === 1
    ? actionButton({ id: 'downtime-start-confirm', label, ariaLabel, action: projected[0]! })
    : inertActionButton({ id: 'downtime-start-confirm', label, ariaLabel, role: 'action-danger' }));
  bottom.push(backButton(input, 'p1BackToDowntimeComment', {
    machine_id: current.machine_id!, downtime_type_id: current.downtime_type_id!, downtime_type_name: current.downtime_type_name!,
  }, 'downtime-start-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-D13', ariaLabel: 'Подтвердите начало простоя',
    bridgeProjection: { nodeId: 'S03-D13', items: [...scroll, ...bottom] },
    slots: { fixedTop: [], scroll: scroll.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}

export function projectSection03P1(input: P1NodeInput<Section03P1SpecializedNodeId>): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-N01': return projectMain(input as P1NodeInput<'S03-N01'>);
    case 'S03-M01': return projectMachines(input as P1NodeInput<'S03-M01'>);
    case 'S03-M02': return projectMachineCard(input as P1NodeInput<'S03-M02'>);
    case 'S03-M03O': return projectOperationalFinish(input as P1NodeInput<'S03-M03O'>);
    case 'S03-M03C': return projectCriticalFinishComment(input as P1NodeInput<'S03-M03C'>);
    case 'S03-M04C': return projectCriticalFinishConfirm(input as P1NodeInput<'S03-M04C'>);
    case 'S03-D01': return projectDowntimes(input as P1NodeInput<'S03-D01'>);
    case 'S03-D10': return projectDowntimeTypes(input as P1NodeInput<'S03-D10'>);
    case 'S03-D11': return projectDowntimeMachines(input as P1NodeInput<'S03-D11'>);
    case 'S03-D12': return projectDowntimeComment(input as P1NodeInput<'S03-D12'>);
    case 'S03-D13': return projectDowntimeStartConfirm(input as P1NodeInput<'S03-D13'>);
  }
}
