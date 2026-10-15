import type { GraphActionInstanceCommonInput } from '../foundation/graphProtocol';
import type { GraphActivationReadyState, GraphReadyNodeActionFactory } from '../foundation/graphRuntime';
import type {
  ControlSemanticKey,
  PresentationFormDraftController,
  PresentationGraphBridgeItemInput,
  PresentationGraphBridgeProjection,
  PresentationGraphContentInput,
} from '../foundation/presentation';
import { formatDisplayInteger, formatPersonName } from '../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../foundation/presentation/graphBridge/model';
import type { Section02BusinessActionId } from './commands';
import type { S02ActionId } from './section02GraphActions';
import type { Section02Context } from './context';
import type { Section02NodeId } from './ids';
import type { Section02LoadedNodeData } from './loaders';
import { ADDITIONAL_WORK_START_BLOCKER_MESSAGES } from './contracts';
import { SECTION02_POLICY_ROOTS, section02ActionAuthority, section02Authority, section02LegacyActionAuthority } from './presentation';
import { isSection02NodeProjection, type Section02Program } from './program';
import { SECTION02_BACK_CAPABILITY, SECTION02_FORWARD_TARGETS } from './topology';
import { formatSection02SalaryMonth } from './salaryMonth';

export type Section02ScreenProjection = Readonly<{
  nodeId: Section02NodeId;
  ariaLabel: string;
  fixedTopTitle: string | undefined;
  bridgeProjection: PresentationGraphBridgeProjection;
  slots: Readonly<{ fixedTop: readonly string[]; scroll: readonly string[]; fixedBottom: readonly string[] }>;
}>;

type ProjectionInput = Readonly<{
  nodeId: Section02NodeId;
  ready: GraphActivationReadyState<Section02NodeId>;
  actionFactory: GraphReadyNodeActionFactory<Section02Program, Section02NodeId>;
  formController?: PresentationFormDraftController;
}>;

type RuntimeFactory = Readonly<{
  business: (actionId: string, input: GraphActionInstanceCommonInput, event: Section02Context) => readonly object[];
  presentation: (actionId: string, input: GraphActionInstanceCommonInput, event: Section02Context) => object;
}>;

function text(value: string): PresentationGraphContentInput {
  return Object.freeze({ kind: 'text' as const, text: value });
}

function interaction(action: object | null, enabled = true) {
  return action === null
    ? Object.freeze({ kind: 'inert' as const })
    : Object.freeze({ kind: 'action' as const, action, baseAvailability: enabled ? 'enabled' as const : 'disabled' as const });
}

function line(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function contentLine(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function card(id: string, title: string | undefined, lines: readonly PresentationGraphCardLineInput[], rootId: string = SECTION02_POLICY_ROOTS.staticInfoCard, evidence: unknown = null): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'card', id, presentationAuthority: section02Authority(rootId, evidence),
    ...(title === undefined ? {} : { title: text(title), ariaLabel: title }),
    lines,
  });
}

function message(id: string, value: string, rootId: string = SECTION02_POLICY_ROOTS.staticInfoMessage, evidence: unknown = null): PresentationGraphBridgeItemInput {
  return Object.freeze({ kind: 'message', id, presentationAuthority: section02Authority(rootId, evidence), content: text(value) });
}

function summary(id: string, value: string): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'summary-line', id,
    presentationAuthority: section02Authority(SECTION02_POLICY_ROOTS.staticNeutralSummary, null),
    content: text(value),
  });
}

function actionButton(id: string, label: string, action: object | null, actionId: S02ActionId, enabled = true): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'control-action-button', id, presentationAuthority: section02LegacyActionAuthority(actionId),
    interaction: interaction(action, enabled), label: text(label), ariaLabel: label,
  });
}

function semanticActionButton(id: string, label: string, action: object | null, role: ControlSemanticKey, enabled = true): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'control-action-button', id, presentationAuthority: section02ActionAuthority(role),
    interaction: interaction(action, enabled), label: text(label), ariaLabel: label,
  });
}

function stateRow(input: Readonly<{
  id: string; label: string; detail?: string; action?: object | null; rootId: string; evidence: unknown; enabled?: boolean;
}>): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'state-list-button', id: input.id, presentationAuthority: section02Authority(input.rootId, input.evidence),
    interaction: interaction(input.action ?? null, input.enabled ?? true), mainLine: text(input.label),
    ...(input.detail === undefined ? {} : { secondaryLine: text(input.detail) }), ariaLabel: input.label,
  });
}

function salary(value: string): string {
  return `${formatDisplayInteger(value)} сум`;
}

function source(input: ProjectionInput): Readonly<{ context: Section02Context; data: Section02LoadedNodeData }> {
  if (!isSection02NodeProjection(input.ready.projection) || input.ready.projection.screenId !== input.nodeId) {
    throw new Error(`Invalid Section 02 projection for ${input.nodeId}.`);
  }
  return Object.freeze({ context: input.ready.projection.context, data: input.ready.projection.data });
}

function factory(input: ProjectionInput): RuntimeFactory {
  return input.actionFactory as unknown as RuntimeFactory;
}

function event(input: ProjectionInput, additions: Partial<Section02Context> = {}): Section02Context {
  return Object.freeze({ ...source(input).context, ...additions });
}

function presentationAction(input: ProjectionInput, target: Section02NodeId, id: string, additions: Partial<Section02Context> = {}): object {
  const index = SECTION02_FORWARD_TARGETS[input.nodeId].indexOf(target as never);
  if (index < 0) throw new Error(`Missing Section 02 transition ${input.nodeId} -> ${target}.`);
  return factory(input).presentation(`navigate${index}`, { instanceId: id, ariaLabel: id }, event(input, additions));
}

function backAction(input: ProjectionInput, id: string, additions: Partial<Section02Context> = {}): object {
  if (!SECTION02_BACK_CAPABILITY[input.nodeId]) throw new Error(`Section 02 node ${input.nodeId} has no Back route.`);
  return factory(input).presentation('back', { instanceId: id, ariaLabel: 'Назад' }, event(input, additions));
}

function businessAction(input: ProjectionInput, actionId: Section02BusinessActionId, id: string, additions: Partial<Section02Context> = {}): object | null {
  const actions = factory(input).business(actionId, { instanceId: id, ariaLabel: id }, event(input, additions));
  if (actions.length > 1) throw new Error(`Section 02 ${input.nodeId}:${actionId} produced duplicate instances.`);
  return actions[0] ?? null;
}

function finishShiftTarget(data: Section02LoadedNodeData): 'S02-FS01' | 'S02-FS02' {
  const state = data.workplace?.finish_shift;
  const blockers = [...(state?.blockers ?? []), ...(state?.blocking_reasons ?? [])];
  if (blockers.length > 0 || state?.can_finish_now === false || state?.can_finish_shift === false) return 'S02-FS02';
  return 'S02-FS01';
}

export function formatOperatorName(fullName: string): string {
  return formatPersonName(fullName);
}

function projectWorkplace(
  input: ProjectionInput,
  fixedTop: PresentationGraphBridgeItemInput[],
  scroll: PresentationGraphBridgeItemInput[],
  bottom: PresentationGraphBridgeItemInput[],
): void {
  const { data } = source(input);
  const workplace = data.workplace!;
  if (input.nodeId === 'S02-N01') {
    const start = businessAction(input, 'START_SHIFT', 'start-shift');
    scroll.push(actionButton('start-shift', 'Начать смену', start, 'start_shift'));
    scroll.push(actionButton('salary', 'Зарплата', presentationAction(input, 'S02-SAL01', 'salary'), 'salary'));
    return;
  }
  const productionActive = workplace.production?.is_active === true || workplace.production?.production_operation_id != null;
  const additionalWorkActive = workplace.additional_work_summary?.has_active_additional_work === true;
  const workplaceLines: PresentationGraphCardLineInput[] = [
    line('operator', 'Оператор', formatOperatorName(workplace.actor_full_name ?? '') || '—'),
  ];
  if (productionActive) {
    workplaceLines.push(
      line('machine', 'Станок', workplace.production?.machine_name ?? '—'),
      line('sku', 'SKU', workplace.production?.sku_name ?? workplace.production?.sku_code ?? '—'),
    );
  }
  if (additionalWorkActive) {
    workplaceLines.push(line('additional-work', 'Доп. работа', workplace.additional_work_summary?.active_additional_work_name ?? '—'));
  }
  fixedTop.push(card(
    'workplace-state',
    undefined,
    workplaceLines,
    SECTION02_POLICY_ROOTS.domainCard,
    productionActive ? 'workplace-production' : additionalWorkActive ? 'workplace-additional' : 'workplace-idle',
  ));

  if (productionActive) {
    bottom.push(actionButton('production-finish-open', 'Завершить производство', presentationAction(input, 'S02-N08', 'production-finish-open', {
      production_operation_id: workplace.production?.production_operation_id ?? undefined,
      machine_name: workplace.production?.machine_name ?? undefined,
      sku_code: workplace.production?.sku_code ?? undefined,
      sku_name: workplace.production?.sku_name ?? undefined,
    }), 'finish_production', workplace.production?.can_finish_production === true));
  } else {
    bottom.push(actionButton(
      'production-open',
      'Начать производство',
      presentationAction(input, 'S02-N03', 'production-open'),
      'start_production',
      data.availableActions.includes('START_PRODUCTION'),
    ));
  }

  const breakActive = workplace.break?.is_active === true || workplace.break?.operator_break_id != null;
  bottom.push(breakActive
    ? actionButton('break-finish-open', 'Завершить перерыв', presentationAction(input, 'S02-B03', 'break-finish-open'), 'finish_break', workplace.break?.can_finish_break === true)
    : actionButton('break-open', 'Начать перерыв', presentationAction(input, 'S02-B01', 'break-open'), 'start_break', data.availableActions.includes('START_BREAK')));

  if (workplace.downtime?.can_finish_downtime === true && workplace.downtime.downtime_id) {
    bottom.push(actionButton('downtime-finish-open', `Завершить: ${workplace.downtime.downtime_type_name ?? 'простой'}`, presentationAction(input, 'S02-N10', 'downtime-finish-open', {
      downtime_id: workplace.downtime.downtime_id, downtime_type_name: workplace.downtime.downtime_type_name ?? undefined,
      downtime_class: workplace.downtime.downtime_class === 'CRITICAL' ? 'CRITICAL' : 'OPERATIONAL',
      production_operation_id: workplace.production?.production_operation_id ?? undefined,
    }), workplace.downtime.downtime_class === 'CRITICAL' ? 'finish_downtime_critical' : 'finish_downtime_operational'));
  } else {
    bottom.push(actionButton(
      'downtime-open',
      'Начать простой',
      presentationAction(input, 'S02-N09', 'downtime-open'),
      'start_downtime',
      data.availableActions.includes('START_DOWNTIME') && workplace.downtime?.can_start_downtime === true,
    ));
  }
  bottom.push(actionButton(
    'additional-work-open',
    'Допработа',
    presentationAction(input, 'S02-N11', 'additional-work-open'),
    'additional_work',
    data.availableActions.includes('OPEN_ADDITIONAL_WORK'),
  ));
  const finishTarget = finishShiftTarget(data);
  bottom.push(actionButton('finish-shift-open', 'Завершить смену', presentationAction(input, finishTarget, 'finish-shift-open'), 'finish_shift', data.availableActions.includes('FINISH_SHIFT')));
  bottom.push(actionButton('salary-open', 'Зарплата', presentationAction(input, 'S02-SAL01', 'salary-open'), 'salary', data.availableActions.includes('VIEW_SALARY')));
  scroll.push(...bottom);
  bottom.length = 0;
}

function projectProduction(input: ProjectionInput, scroll: PresentationGraphBridgeItemInput[], bottom: PresentationGraphBridgeItemInput[]): void {
  const { context, data } = source(input);
  if (input.nodeId === 'S02-N03') {
    scroll.push(actionButton('scan-machine-qr', 'Сканировать QR станка', presentationAction(input, 'S02-QR01', 'scan-machine-qr'), 'scan_machine_qr'));
    scroll.push(actionButton('machine-list-open', 'Выбрать станок из списка', presentationAction(input, 'S02-N04', 'machine-list-open', { machine_selection_mode: 'production' }), 'select_machine_from_list'));
    bottom.push(actionButton('production-entry-back', 'Назад', backAction(input, 'production-entry-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-QR01') {
    const qr = data.machineQr;
    const machine = qr?.found === true ? qr.machine : null;
    const selectable = machine?.is_selectable_for_production === true;
    let detail = 'Не удалось проверить QR. Нажмите «Назад» и повторите сканирование.';
    if (qr?.found === false && qr.error_code === 'MACHINE_QR_NOT_FOUND') detail = 'QR станка не распознан.';
    else if (qr?.found === false && qr.error_code === 'SCANNER_CANCELLED') detail = 'Сканирование отменено.';
    else if (qr?.found === false && qr.error_code === 'SCANNER_UNAVAILABLE') detail = 'Сканер QR недоступен. Нажмите «Назад».';
    else if (machine !== null && selectable) detail = 'Проверьте станок и подтвердите выбор.';
    else if (machine?.production_unavailability?.code === 'OCCUPIED_BY_OPERATOR') {
      detail = `На станке уже работает:\n${formatPersonName(machine.production_unavailability.operator_full_name)}`;
    } else if (machine?.production_unavailability?.code === 'MACHINE_BROKEN') {
      detail = 'Станок неисправен. Обратитесь к начальнику производства.';
    } else if (machine?.production_unavailability?.code === 'MACHINE_DOWNTIME') {
      detail = 'На станке открыт простой.';
    } else if (machine?.production_unavailability?.code === 'MACHINE_OUT_OF_SERVICE') {
      detail = 'Станок выведен из эксплуатации.';
    } else if (machine?.production_unavailability?.code === 'MACHINE_NOT_READY') {
      detail = machine.production_unavailability.machine_status === null
        ? 'Станок недоступен для производства.'
        : `Станок недоступен для производства.\nСтатус: ${machine.production_unavailability.machine_status}`;
    }
    const domainEvidence = selectable ? 'selectable' : machine === null ? 'neutral' : 'unselectable';
    scroll.push(card(
      'qr-machine-result',
      'Результат сканирования',
      [
        line('machine', 'Станок', machine?.machine_name ?? '—'),
        line('availability', 'Статус', selectable ? 'Доступен для производства' : machine === null ? 'Не определён' : 'Недоступен для производства'),
      ],
      SECTION02_POLICY_ROOTS.domainCard,
      domainEvidence,
    ));
    scroll.push(message('qr-machine-detail', detail, SECTION02_POLICY_ROOTS.domainMessage, domainEvidence));
    bottom.push(actionButton(
      'qr-machine-select',
      'Выбрать станок',
      selectable && machine !== null
        ? presentationAction(input, 'S02-SKU01', 'qr-machine-select', { machine_id: machine.machine_id, machine_name: machine.machine_name })
        : null,
      'select_machine',
      selectable,
    ));
    bottom.push(actionButton('qr-back', 'Назад', backAction(input, 'qr-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-N04') {
    const productionMode = context.machine_selection_mode === 'production';
    data.machines.forEach((machine) => {
      const selectable = productionMode ? machine.is_selectable_for_production !== false : machine.is_selectable_for_critical_downtime === true;
      const target = productionMode ? 'S02-SKU01' : 'S02-N26_keyboard';
      const action = selectable ? presentationAction(input, target, `machine-${machine.machine_id}`, {
        machine_id: machine.machine_id, machine_name: machine.machine_name,
        ...(productionMode ? {} : { production_requirement: 'not_required' as const }),
      }) : null;
      scroll.push(stateRow({
        id: `machine-${machine.machine_id}`,
        label: machine.machine_name,
        action,
        rootId: SECTION02_POLICY_ROOTS.machineList,
        evidence: machine.ui_status_token,
        enabled: selectable,
      }));
    });
    if (data.machines.length === 0) scroll.push(message('machines-empty', 'Доступные станки отсутствуют.'));
    bottom.push(actionButton('machine-back', 'Назад', backAction(input, 'machine-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-SKU01') {
    scroll.push(actionButton('scan-sku-qr', 'Сканировать QR SKU', presentationAction(input, 'S02-SKUQR01', 'scan-sku-qr'), 'scan_sku_qr'));
    scroll.push(actionButton('sku-list-open', 'Выбрать SKU из списка', presentationAction(input, 'S02-N05', 'sku-list-open'), 'select_sku_from_list'));
    bottom.push(actionButton('sku-entry-back', 'Назад', backAction(input, 'sku-entry-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-SKUQR01') {
    const qr = data.skuQr;
    const sku = qr?.found === true ? qr.sku : null;
    const selectable = sku?.is_selectable_for_production === true;
    let detail = 'Не удалось проверить QR. Нажмите «Назад» и повторите сканирование.';
    if (qr?.found === false && qr.error_code === 'SKU_QR_NOT_FOUND') detail = 'QR SKU не распознан.';
    else if (qr?.found === false && qr.error_code === 'SCANNER_CANCELLED') detail = 'Сканирование отменено.';
    else if (qr?.found === false && qr.error_code === 'SCANNER_UNAVAILABLE') detail = 'Сканер QR недоступен. Нажмите «Назад».';
    else if (sku !== null && selectable) detail = 'Проверьте SKU и подтвердите выбор.';
    else if (sku?.production_unavailability?.code === 'SKU_INACTIVE') {
      detail = 'SKU недоступен для производства. Обратитесь к начальнику производства.';
    }
    const domainEvidence = selectable ? 'selectable' : sku === null ? 'neutral' : 'unselectable';
    scroll.push(card(
      'qr-sku-result',
      'Результат сканирования',
      [
        line('sku-code', 'SKU', sku?.sku_code ?? '—'),
        line('sku-name', 'Наименование', sku?.sku_name ?? '—'),
      ],
      SECTION02_POLICY_ROOTS.domainCard,
      domainEvidence,
    ));
    scroll.push(message('qr-sku-detail', detail, SECTION02_POLICY_ROOTS.domainMessage, domainEvidence));
    bottom.push(actionButton(
      'qr-sku-select',
      'Выбрать SKU',
      selectable && sku !== null
        ? businessAction(input, 'START_PRODUCTION', 'qr-sku-select', { sku_id: sku.sku_id, sku_code: sku.sku_code, sku_name: sku.sku_name })
        : null,
      'select_sku',
      selectable,
    ));
    bottom.push(actionButton('sku-qr-back', 'Назад', backAction(input, 'sku-qr-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-N05') {
    data.skus.forEach((sku) => {
      const action = businessAction(input, 'START_PRODUCTION', `sku-${sku.sku_id}`, { sku_id: sku.sku_id, sku_code: sku.sku_code, sku_name: sku.sku_name });
      scroll.push(stateRow({ id: `sku-${sku.sku_id}`, label: sku.sku_code, detail: sku.sku_name, action, rootId: SECTION02_POLICY_ROOTS.staticInfoList, evidence: null, enabled: sku.is_active !== false && action !== null }));
    });
    if (scroll.length === 0) scroll.push(message('skus-empty', 'Доступные SKU отсутствуют.'));
    bottom.push(actionButton('sku-back', 'Назад', backAction(input, 'sku-back'), 'back'));
    return;
  }
  if (input.formController !== undefined) scroll.push(Object.freeze({ kind: 'form-field', id: 'quantity-field', controller: input.formController, fieldId: 'quantity_produced' }));
  const draft = input.formController?.valid === true
    ? { quantity_produced: input.formController.field('quantity_produced').validation.normalizedValue }
    : {};
  const action = businessAction(input, 'FINISH_PRODUCTION', 'production-finish', draft);
  bottom.push(actionButton('production-finish', 'Завершить производство', action, 'finish_production', input.formController?.valid === true));
  bottom.push(actionButton('production-finish-back', 'Назад', backAction(input, 'production-finish-back'), 'back'));
}

function projectBreak(input: ProjectionInput, scroll: PresentationGraphBridgeItemInput[], bottom: PresentationGraphBridgeItemInput[]): void {
  const { data } = source(input);
  if (input.nodeId === 'S02-B01') {
    data.breakTypes.forEach((item) => {
      const action = businessAction(input, 'START_BREAK', `break-${item.break_type_id}`, { break_type_id: item.break_type_id, break_type_name: item.display_name });
      scroll.push(semanticActionButton(`break-${item.break_type_id}`, `Начать\n${item.display_name}`, action, 'action-warning', item.is_active !== false));
    });
    if (scroll.length === 0) scroll.push(message('break-types-empty', 'Доступные типы перерыва отсутствуют.'));
    bottom.push(actionButton('break-back', 'Назад', backAction(input, 'break-back'), 'back'));
    return;
  }
  scroll.push(card('break-finish-card', 'Тип перерыва:', [contentLine('break-name', data.workplace?.break?.break_type_name ?? '—')], SECTION02_POLICY_ROOTS.staticWarningFieldCard));
  const action = businessAction(input, 'FINISH_BREAK', 'break-finish');
  bottom.push(actionButton('break-finish', 'Завершить перерыв', action, 'finish_break'));
  bottom.push(actionButton('break-finish-back', 'Назад', backAction(input, 'break-finish-back'), 'back'));
}

function projectDowntime(input: ProjectionInput, scroll: PresentationGraphBridgeItemInput[], bottom: PresentationGraphBridgeItemInput[]): void {
  const { context, data } = source(input);
  if (input.nodeId === 'S02-N09') {
    const workplace = data.workplace!;
    const activeProductionId = data.downtimeTypes?.active_production_operation_id;
    const machineId = workplace.production?.machine_id;
    const machineName = workplace.production?.machine_name;
    const rows = [...(data.downtimeTypes?.available_downtime_types ?? [])].sort((a, b) => (a.downtime_class === b.downtime_class ? 0 : a.downtime_class === 'OPERATIONAL' ? -1 : 1));
    rows.forEach((item) => {
      const additions: Partial<Section02Context> = {
        downtime_type_id: item.downtime_type_id, downtime_type_name: item.display_name, downtime_class: item.downtime_class,
        production_requirement: item.requires_production_operation ? 'required' : 'not_required',
        production_operation_id: activeProductionId ?? undefined, machine_id: machineId ?? undefined, machine_name: machineName ?? undefined,
      };
      let action: object | null;
      if (item.downtime_class === 'OPERATIONAL') action = machineId && activeProductionId ? businessAction(input, 'START_OPERATIONAL_DOWNTIME', `downtime-${item.downtime_type_id}`, additions) : null;
      else if (machineId) action = presentationAction(input, 'S02-N26_keyboard', `downtime-${item.downtime_type_id}`, additions);
      else action = presentationAction(input, 'S02-N04', `downtime-${item.downtime_type_id}`, { ...additions, machine_selection_mode: 'critical_downtime' });
      scroll.push(semanticActionButton(
        `downtime-${item.downtime_type_id}`,
        `Начать:\n${item.display_name}`,
        action,
        item.downtime_class === 'CRITICAL' ? 'action-danger' : 'action-warning',
        action !== null,
      ));
    });
    if (rows.length === 0) scroll.push(message('downtime-types-empty', 'Доступные типы простоя отсутствуют.'));
    bottom.push(actionButton('downtime-back', 'Назад', backAction(input, 'downtime-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-N26_keyboard') {
    if (input.formController !== undefined) scroll.push(Object.freeze({ kind: 'form-field', id: 'comment-field', controller: input.formController, fieldId: 'comment' }));
    const draft = input.formController?.valid === true
      ? { comment: input.formController.field('comment').validation.normalizedValue }
      : {};
    bottom.push(semanticActionButton('downtime-comment-next', 'Далее', presentationAction(input, 'S02-N27', 'downtime-comment-next', draft), 'action-danger', input.formController?.valid === true));
    bottom.push(actionButton('downtime-comment-back', 'Назад', backAction(input, 'downtime-comment-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-N27') {
    scroll.push(card('downtime-confirm-card', undefined, [contentLine('comment', `Комментарий:\n${context.comment ?? '—'}`)], SECTION02_POLICY_ROOTS.staticInfoOutlineCard));
    const action = businessAction(input, 'START_CRITICAL_DOWNTIME', 'downtime-confirm');
    bottom.push(actionButton('downtime-confirm', `Начать:\n${context.downtime_type_name ?? 'простой'}`, action, 'finish_downtime_critical'));
    bottom.push(actionButton('downtime-confirm-back', 'Назад', backAction(input, 'downtime-confirm-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-N28') {
    bottom.push(semanticActionButton('downtime-result-close', 'К рабочему месту', presentationAction(input, 'S02-N02', 'downtime-result-close'), 'navigation-open'));
    return;
  }
  const workplace = data.workplace!;
  const action = businessAction(input, 'FINISH_DOWNTIME', 'downtime-finish', { downtime_id: workplace.downtime?.downtime_id ?? context.downtime_id });
  const downtimeName = workplace.downtime?.downtime_type_name ?? context.downtime_type_name ?? 'простой';
  bottom.push(actionButton('downtime-finish', `Завершить:\n${downtimeName}`, action, context.downtime_class === 'CRITICAL' ? 'finish_downtime_critical' : 'finish_downtime_operational'));
  bottom.push(actionButton('downtime-finish-back', 'Назад', backAction(input, 'downtime-finish-back'), 'back'));
}

function projectAdditionalWork(input: ProjectionInput, scroll: PresentationGraphBridgeItemInput[], bottom: PresentationGraphBridgeItemInput[]): void {
  const { context, data } = source(input);
  if (input.nodeId === 'S02-N11') {
    const state = data.additionalWork!;
    if (state.active_additional_works.length > 0) scroll.push(summary('additional-work-active-group', 'Выполняемые'));
    state.active_additional_works.forEach((item) => scroll.push(stateRow({ id: `active-${item.additional_work_id}`, label: `Завершить:\n${item.display_name}`, action: presentationAction(input, 'S02-AW04', `active-${item.additional_work_id}`, { additional_work_id: item.additional_work_id, additional_work_type_id: item.additional_work_type_id, additional_work_name: item.display_name }), rootId: SECTION02_POLICY_ROOTS.backendList, evidence: item.ui_color_token })));
    if (state.approved_additional_works.length > 0) scroll.push(summary('additional-work-approved-group', 'Согласованные'));
    state.approved_additional_works.forEach((item) => {
      scroll.push(stateRow({ id: `approved-${item.additional_work_id}`, label: `Начать:\n${item.display_name}`, action: presentationAction(input, 'S02-AW03', `approved-${item.additional_work_id}`, { additional_work_id: item.additional_work_id, additional_work_type_id: item.additional_work_type_id, additional_work_name: item.display_name }), rootId: SECTION02_POLICY_ROOTS.backendList, evidence: item.ui_color_token }));
    });
    if (state.pending_approval_additional_works.length > 0) scroll.push(summary('additional-work-pending-group', 'На согласовании'));
    state.pending_approval_additional_works.forEach((item) => scroll.push(stateRow({ id: `pending-${item.additional_work_id}`, label: item.display_name, rootId: SECTION02_POLICY_ROOTS.backendList, evidence: item.ui_color_token })));
    if (scroll.length === 0) scroll.push(message('additional-work-empty', 'Допработы отсутствуют.'));
    bottom.push(actionButton(
      'additional-request-open',
      'Запросить допработу',
      data.availableActions.includes('REQUEST_ADDITIONAL_WORK')
        ? presentationAction(input, 'S02-AW01', 'additional-request-open')
        : null,
      'request_additional_work',
    ));
    bottom.push(actionButton('additional-menu-back', 'Назад', backAction(input, 'additional-menu-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-AW01') {
    data.additionalWorkTypes!.additional_work_types.forEach((item) => scroll.push(stateRow({ id: `type-${item.additional_work_type_id}`, label: item.display_name, action: presentationAction(input, 'S02-AW02', `type-${item.additional_work_type_id}`, { additional_work_type_id: item.additional_work_type_id, additional_work_name: item.display_name }), rootId: SECTION02_POLICY_ROOTS.staticNeutralList, evidence: null })));
    if (scroll.length === 0) scroll.push(message('additional-work-types-empty', 'Доступные типы допработ отсутствуют.'));
    bottom.push(actionButton('additional-types-back', 'Назад', backAction(input, 'additional-types-back'), 'back'));
    return;
  }
  if (input.nodeId === 'S02-AW05') {
    scroll.push(card('additional-result', undefined, [
      contentLine('result-title', 'Допработа завершена:'),
      contentLine('result-name', context.additional_work_name ?? '—'),
      contentLine('result-status', 'Ожидает решения по оплате.'),
    ], SECTION02_POLICY_ROOTS.staticNeutralResultCard));
    bottom.push(semanticActionButton('additional-result-close', 'К допработам', presentationAction(input, 'S02-N11', 'additional-result-close'), 'navigation-open'));
    return;
  }
  if (input.nodeId === 'S02-AW03') {
    data.additionalWorkStartBlockers.forEach((blocker, index) => scroll.push(Object.freeze({
      kind: 'message' as const,
      id: `additional-work-start-blocker-${index}`,
      presentationAuthority: section02Authority(SECTION02_POLICY_ROOTS.staticWarningMessage, null),
      content: text(ADDITIONAL_WORK_START_BLOCKER_MESSAGES[blocker]),
      role: 'alert' as const,
      ariaLive: 'assertive' as const,
    })));
  }
  const selectedWork = context.additional_work_name ?? '—';
  if (input.nodeId === 'S02-AW02') {
    scroll.push(card('additional-confirm-card', undefined, [
      contentLine('question', 'Вы хотите запросить:'),
      contentLine('work-name', selectedWork),
      contentLine('question-mark', '?'),
    ], SECTION02_POLICY_ROOTS.staticNeutralContentCard));
  } else if (input.nodeId === 'S02-AW04') {
    scroll.push(card('additional-confirm-card', undefined, [
      contentLine('question', 'Вы хотите завершить:'),
      contentLine('work-name', selectedWork),
      contentLine('question-mark', '?'),
    ], SECTION02_POLICY_ROOTS.staticNeutralContentCard));
  } else {
    scroll.push(card('additional-confirm-card', undefined, [contentLine('work-name', selectedWork)], SECTION02_POLICY_ROOTS.staticNeutralOutlineCard));
  }
  const actionId: Section02BusinessActionId = input.nodeId === 'S02-AW02' ? 'REQUEST_ADDITIONAL_WORK' : input.nodeId === 'S02-AW04' ? 'FINISH_ADDITIONAL_WORK' : 'START_ADDITIONAL_WORK';
  const action = businessAction(input, actionId, `additional-${actionId.toLowerCase()}`);
  bottom.push(actionButton(
    'additional-confirm',
    input.nodeId === 'S02-AW02'
      ? `Запросить:\n${selectedWork}`
      : input.nodeId === 'S02-AW04'
        ? `Завершить:\n${selectedWork}`
        : `Начать:\n${selectedWork}`,
    action,
    input.nodeId === 'S02-AW02'
      ? 'request_additional_work'
      : input.nodeId === 'S02-AW04'
        ? 'finish_additional_work'
        : 'start_additional_work',
  ));
  bottom.push(actionButton('additional-confirm-back', 'Назад', backAction(input, 'additional-confirm-back'), 'back'));
}

type FinishShiftBlockerToken = 'PRODUCTION' | 'BREAK' | 'ADDITIONAL_WORK' | 'OPERATIONAL_DOWNTIME';

function finishShiftBlockerToken(value: string): FinishShiftBlockerToken | null {
  const normalized = value.trim().toUpperCase();
  if (['PRODUCTION', 'ACTIVE_PRODUCTION', 'PRODUCTION_OPERATION', 'ACTIVE_PRODUCTION_OPERATION'].includes(normalized)) return 'PRODUCTION';
  if (['BREAK', 'ACTIVE_BREAK', 'OPERATOR_BREAK', 'ACTIVE_OPERATOR_BREAK'].includes(normalized)) return 'BREAK';
  if (['ADDITIONAL_WORK', 'ACTIVE_ADDITIONAL_WORK'].includes(normalized)) return 'ADDITIONAL_WORK';
  if (['OPERATIONAL_DOWNTIME', 'ACTIVE_OPERATIONAL_DOWNTIME'].includes(normalized)) return 'OPERATIONAL_DOWNTIME';
  return null;
}

function projectShiftFinish(input: ProjectionInput, scroll: PresentationGraphBridgeItemInput[], bottom: PresentationGraphBridgeItemInput[]): void {
  const { data } = source(input);
  const finish = data.workplace!.finish_shift;
  const blockers = [...(finish?.blockers ?? []), ...(finish?.blocking_reasons ?? [])];
  const warnings = [...(finish?.warnings ?? []), ...(finish?.warning_messages ?? [])];
  if (input.nodeId === 'S02-FS02') {
    const workplace = data.workplace!;
    blockers.forEach((value, index) => {
      const token = finishShiftBlockerToken(value);
      if (token === null) {
        scroll.push(message(`shift-blocker-${index}`, value));
        return;
      }
      const target = token === 'PRODUCTION' ? 'S02-N08' : token === 'BREAK' ? 'S02-B03' : token === 'OPERATIONAL_DOWNTIME' ? 'S02-N10' : 'S02-N11';
      const additions: Partial<Section02Context> = {
        production_operation_id: workplace.production?.production_operation_id ?? undefined,
        downtime_id: workplace.downtime?.downtime_id ?? undefined,
        downtime_type_name: workplace.downtime?.downtime_type_name ?? undefined,
        downtime_class: workplace.downtime?.downtime_class === 'CRITICAL' ? 'CRITICAL' : 'OPERATIONAL',
        additional_work_id: workplace.additional_work_summary?.active_additional_work_id ?? undefined,
        additional_work_name: workplace.additional_work_summary?.active_additional_work_name ?? undefined,
      };
      const label = token === 'PRODUCTION'
        ? 'Завершить производство'
        : token === 'BREAK'
          ? `Завершить:\n${workplace.break?.break_type_name ?? '—'}`
          : token === 'OPERATIONAL_DOWNTIME'
            ? `Завершить:\n${workplace.downtime?.downtime_type_name ?? '—'}`
            : `Завершить:\n${workplace.additional_work_summary?.active_additional_work_name ?? 'допработу'}`;
      scroll.push(semanticActionButton(
        `shift-blocker-${token.toLowerCase()}-${index}`,
        label,
        presentationAction(input, target, `shift-blocker-${index}`, additions),
        token === 'BREAK' || token === 'OPERATIONAL_DOWNTIME' ? 'action-warning' : 'action-positive',
      ));
    });
    bottom.push(actionButton('shift-finish-disabled', 'Завершить смену', null, 'finish_shift', false));
    bottom.push(actionButton('shift-blocked-back', 'Назад', backAction(input, 'shift-blocked-back'), 'back'));
    return;
  }
  scroll.push(message('shift-finish-confirm', 'Подтвердите завершение текущей смены.'));
  warnings.forEach((value, index) => scroll.push(message(
    `shift-warning-${index}`,
    value === 'APPROVED_ADDITIONAL_WORKS_NOT_STARTED'
      ? 'Есть согласованные допработы, которые ещё не начаты.'
      : value,
    SECTION02_POLICY_ROOTS.staticNeutralMessage,
  )));
  if (warnings.length > 0) {
    scroll.push(semanticActionButton(
      'shift-warning-additional-work',
      'Перейти к допработам',
      presentationAction(input, 'S02-N11', 'shift-warning-additional-work'),
      'action-neutral',
    ));
  }
  const action = businessAction(input, 'FINISH_SHIFT', 'shift-finish');
  bottom.push(actionButton('shift-finish', 'Завершить смену', action, 'finish_shift'));
  bottom.push(actionButton('shift-finish-back', 'Назад', backAction(input, 'shift-finish-back'), 'back'));
}

function projectSalary(input: ProjectionInput, scroll: PresentationGraphBridgeItemInput[], bottom: PresentationGraphBridgeItemInput[]): void {
  const { data } = source(input);
  if (input.nodeId === 'S02-SAL01') {
    const totals = data.salaryTotals!;
    scroll.push(card('salary-summary', undefined, [line('today', 'Сегодня', salary(totals.today_uzs)), line('week', 'Неделя', salary(totals.week_uzs)), line('month', 'Месяц', salary(totals.month_uzs))], SECTION02_POLICY_ROOTS.staticInfoOutlineCard));
    bottom.push(actionButton('salary-history-open', 'История зарплаты', presentationAction(input, 'S02-SAL02', 'salary-history-open'), 'salary'));
    bottom.push(actionButton('salary-back', 'Назад', backAction(input, 'salary-back'), 'back'));
    return;
  }
  data.salaryMonths.forEach((month, index) => scroll.push(card(`salary-month-${index}`, formatSection02SalaryMonth(month.month), [
    line(`production-${index}`, 'Производство', salary(month.production_uzs)), line(`additional-${index}`, 'Доп.Работы', salary(month.additional_work_uzs)),
    ...(month.corrections_uzs === null ? [] : [line(`corrections-${index}`, 'Корректировки', salary(month.corrections_uzs))]),
    ...(month.reversals_uzs === null ? [] : [line(`reversals-${index}`, 'Сторно', salary(month.reversals_uzs))]), line(`total-${index}`, 'Всего', salary(month.total_uzs)),
  ], SECTION02_POLICY_ROOTS.staticInfoTableCard)));
  if (data.salaryMonths.length === 0) scroll.push(message('salary-history-empty', 'История зарплаты отсутствует.'));
  bottom.push(actionButton('salary-history-back', 'Назад', backAction(input, 'salary-history-back'), 'back'));
}

const titles: Readonly<Record<Section02NodeId, string>> = Object.freeze({
  'S02-N01': 'Смена не начата', 'S02-N02': 'Рабочее место оператора',
  'S02-N03': 'Выбор станка.', 'S02-QR01': 'QR-сканирование', 'S02-N04': 'Выберите станок из списка.',
  'S02-SKU01': 'Выбор SKU.', 'S02-SKUQR01': 'QR-сканирование SKU', 'S02-N05': 'Выберите SKU из списка.', 'S02-N08': 'Введите количество сделанной продукции.',
  'S02-B01': 'Выберите тип перерыва.', 'S02-B03': 'Вы хотите завершить перерыв?', 'S02-N09': 'Выберите тип простоя.', 'S02-N26_keyboard': 'Опишите, что произошло со станком',
  'S02-N27': 'Подтверждение начала простоя', 'S02-N28': 'Информация о неисправности передана', 'S02-N10': 'Вы хотите завершить простой?', 'S02-N11': 'Допработы',
  'S02-AW01': 'Выберите допработу', 'S02-AW02': 'Подтверждение запроса допработы', 'S02-AW03': 'Согласованная допработа',
  'S02-AW04': 'Завершение допработы', 'S02-AW05': 'Допработа завершена', 'S02-FS01': 'Завершить смену?', 'S02-FS02': 'Вы хотите завершить смену?\nСначала закройте:',
  'S02-SAL01': 'Зарплата', 'S02-SAL02': 'История зарплаты',
});

export function createSection02ScreenProjection(input: ProjectionInput): Section02ScreenProjection {
  source(input);
  const fixedTop: PresentationGraphBridgeItemInput[] = [];
  const scroll: PresentationGraphBridgeItemInput[] = [];
  const bottom: PresentationGraphBridgeItemInput[] = [];
  if (['S02-N01', 'S02-N02'].includes(input.nodeId)) projectWorkplace(input, fixedTop, scroll, bottom);
  else if (['S02-N03', 'S02-QR01', 'S02-N04', 'S02-SKU01', 'S02-SKUQR01', 'S02-N05', 'S02-N08'].includes(input.nodeId)) projectProduction(input, scroll, bottom);
  else if (['S02-B01', 'S02-B03'].includes(input.nodeId)) projectBreak(input, scroll, bottom);
  else if (['S02-N09', 'S02-N26_keyboard', 'S02-N27', 'S02-N28', 'S02-N10'].includes(input.nodeId)) projectDowntime(input, scroll, bottom);
  else if (['S02-N11', 'S02-AW01', 'S02-AW02', 'S02-AW03', 'S02-AW04', 'S02-AW05'].includes(input.nodeId)) projectAdditionalWork(input, scroll, bottom);
  else if (['S02-FS01', 'S02-FS02'].includes(input.nodeId)) projectShiftFinish(input, scroll, bottom);
  else projectSalary(input, scroll, bottom);
  const items = Object.freeze([...fixedTop, ...scroll, ...bottom]);
  const title = titles[input.nodeId];
  const current = source(input);
  const fixedTopTitle = ['S02-N01', 'S02-N02', 'S02-N11'].includes(input.nodeId)
    ? undefined
    : input.nodeId === 'S02-N28'
      ? `Информация о технической неисправности станка:\n${current.context.machine_name ?? '—'}\n\nпередана начальнику производства.`
      : input.nodeId === 'S02-N27'
        ? `Вы хотите начать:\n${current.context.downtime_type_name ?? '—'}\n\nна станке:\n${current.context.machine_name ?? '—'}`
        : input.nodeId === 'S02-N10'
          ? `Вы хотите завершить:\n${current.data.workplace?.downtime?.downtime_type_name ?? current.context.downtime_type_name ?? '—'}?`
          : title;
  return Object.freeze({
    nodeId: input.nodeId, ariaLabel: title, fixedTopTitle,
    bridgeProjection: Object.freeze({ nodeId: input.nodeId, items }),
    slots: Object.freeze({ fixedTop: Object.freeze(fixedTop.map((item) => item.id)), scroll: Object.freeze(scroll.map((item) => item.id)), fixedBottom: Object.freeze(bottom.map((item) => item.id)) }),
  });
}
