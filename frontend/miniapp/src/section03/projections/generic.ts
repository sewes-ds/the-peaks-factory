import type { PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type { Section03Context } from '../program/context';
import { SECTION03_CONTEXT_KEYS } from '../program/context';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS, type Section03BusinessActionId } from '../program/business';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import type { Section03ReadRecord, Section03ReadValue } from '../readModels';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  type Section03ScreenProjection,
} from '../presentation';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';
import { SECTION03_P2A2A_SPECIALIZED_NODE_IDS } from './p2a2aShiftClose';
import { SECTION03_P2A2B_SPECIALIZED_NODE_IDS } from './p2a2bBlockers';
import { SECTION03_P2B1_SPECIALIZED_NODE_IDS } from './p2b1CompletedWorks';
import { SECTION03_P2B2_SPECIALIZED_NODE_IDS } from './p2b2Salary';
import { SECTION03_P3A1_SPECIALIZED_NODE_IDS } from './p3a1AdditionalWorkRequests';
import { SECTION03_P3A2_SPECIALIZED_NODE_IDS } from './p3a2AdditionalWorkLifecycle';
import { SECTION03_P3A3_SPECIALIZED_NODE_IDS } from './p3a3AssignAdditionalWork';
import { SECTION03_P3A4_SPECIALIZED_NODE_IDS } from './p3a4AdditionalWorkAccrual';
import { SECTION03_P4A1_SPECIALIZED_NODE_IDS } from './p4a1CorrectionsEntry';
import {
  actionButton,
  backButton,
  cardLine,
  factory,
  interaction,
  nodeData,
  text,
  type P1NodeInput,
} from './common';

const familyTitles = Object.freeze({
  main: 'Рабочее место', machines: 'Станки', downtimes: 'Простои', employees: 'Сотрудники',
  'additional-works': 'Дополнительные работы', salary: 'Заработная плата', corrections: 'Корректировки',
  notifications: 'Уведомления', reports: 'Отчёты',
});

function findScalar(value: Section03ReadValue | undefined, field: string): string | number | undefined {
  if (value === undefined || value === null || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findScalar(item, field);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = value as Section03ReadRecord;
  const direct = record[field];
  if (typeof direct === 'string' || typeof direct === 'number') return direct;
  for (const item of Object.values(record)) {
    const found = findScalar(item, field);
    if (found !== undefined) return found;
  }
  return undefined;
}

function defaultContextValue(field: string): string | undefined {
  if (field === 'period') return 'today';
  if (field === 'work_type') return 'production';
  if (field === 'correction_mode') return 'accrual';
  if (field === 'production_correction_mode') return 'final';
  return undefined;
}

function navigationEvent(
  input: P1NodeInput,
  target: typeof input.nodeId,
): Readonly<{ event: Section03Context; valid: boolean }> {
  const current = nodeData(input);
  const draft = input.formController?.valid === true ? input.formController.commit() : {};
  const output: Record<string, string | number> = { ...current.context, ...draft };
  let valid = input.formController === undefined || input.formController.valid;
  for (const field of SECTION03_NODE_REGISTRY[target].requiredContext) {
    if (output[field] !== undefined) continue;
    const found = findScalar(current.data.primary ?? undefined, field)
      ?? findScalar(current.data.supplemental ?? undefined, field)
      ?? (field === 'downtime_id' ? findScalar(current.data.primary ?? undefined, 'active_downtime_id') : undefined)
      ?? defaultContextValue(field);
    if (found === undefined) valid = false;
    else output[field] = found;
  }
  return Object.freeze({ event: Object.freeze(output) as Section03Context, valid });
}

function businessEvent(input: P1NodeInput, actionId: Section03BusinessActionId): Section03Context {
  const current = nodeData(input);
  const output: Record<string, string | number> = { ...current.context };
  for (const field of SECTION03_CONTEXT_KEYS) {
    if (output[field] !== undefined) continue;
    const found = findScalar(current.data.primary ?? undefined, field)
      ?? findScalar(current.data.supplemental ?? undefined, field)
      ?? (field === 'downtime_id' ? findScalar(current.data.primary ?? undefined, 'active_downtime_id') : undefined)
      ?? defaultContextValue(field);
    if (found !== undefined) output[field] = found;
  }
  if (output.salary_correction_type_id === undefined) {
    const field = output.correction_mode === 'withholding'
      ? 'default_withholding_salary_correction_type_id'
      : 'default_accrual_salary_correction_type_id';
    const value = findScalar(current.data.primary ?? undefined, field);
    if (value !== undefined) output.salary_correction_type_id = value;
  }
  void actionId;
  return Object.freeze(output) as Section03Context;
}

function readableLines(input: P1NodeInput): readonly PresentationGraphCardLineInput[] {
  const lines: PresentationGraphCardLineInput[] = [
    ...cardLine('scenario-id', 'Сценарий', text(input.nodeId)),
  ];
  const ignored = new Set(['section', 'screen', 'available_actions']);
  const collect = (record: Section03ReadRecord, prefix: string): void => {
    for (const [key, value] of Object.entries(record)) {
      if (lines.length >= 10 || ignored.has(key)) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        lines.push(...cardLine(`${prefix}${key}`, key.replaceAll('_', ' '), text(String(value))));
      } else if (value !== null && !Array.isArray(value)) collect(value as Section03ReadRecord, `${prefix}${key}-`);
    }
  };
  const data = nodeData(input).data;
  if (data.primary !== null) collect(data.primary, 'primary-');
  return Object.freeze(lines);
}

export function projectSection03Generic(input: P1NodeInput): Section03ScreenProjection {
  if ((SECTION03_P1_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P1 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P2A1_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P2A1 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P2A2A_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P2A2a node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P2A2B_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P2A2b node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P2B1_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P2B1 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P2B2_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P2B2 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P3A1_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P3A1 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P3A2_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P3A2 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P3A3_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P3A3 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P3A4_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P3A4 node ${input.nodeId} cannot reach generic projection.`);
  }
  if ((SECTION03_P4A1_SPECIALIZED_NODE_IDS as readonly string[]).includes(input.nodeId)) {
    throw new Error(`P4A1 node ${input.nodeId} cannot reach generic projection.`);
  }
  nodeData(input);
  const definition = SECTION03_NODE_REGISTRY[input.nodeId];
  const title = `${familyTitles[definition.family]} · ${input.nodeId}`;
  const scroll: PresentationGraphBridgeItemInput[] = [Object.freeze({
    kind: 'card' as const,
    id: 'scenario-card',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticInfoCard, null),
    title: text(title), lines: readableLines(input), ariaLabel: title,
  })];
  if (definition.projection === 'form') {
    if (input.formController === undefined || input.formController.fieldIds.length !== 1) {
      throw new Error(`Section 03 form controller is missing for ${input.nodeId}.`);
    }
    scroll.push(Object.freeze({
      kind: 'form-field' as const, id: `field-${input.formController.fieldIds[0]}`,
      controller: input.formController, fieldId: input.formController.fieldIds[0]!,
    }));
  }
  const bottom: PresentationGraphBridgeItemInput[] = [];
  const businesses = SECTION03_BUSINESS_ACTIONS.filter((candidate) =>
    (candidate.nodes as readonly string[]).includes(input.nodeId));
  for (const business of businesses) {
    const projected = factory(input).business(
      business.actionId,
      { instanceId: `business-${business.actionId}`, ariaLabel: business.actionId },
      businessEvent(input, business.actionId),
    );
    if (projected.length === 1) bottom.push(actionButton({
      id: `business-${business.actionId}`, label: 'Подтвердить',
      ariaLabel: business.actionId, action: projected[0]!,
    }));
  }
  if (businesses.length === 0) {
    SECTION03_FORWARD_TARGETS[input.nodeId].forEach((target, index) => {
      const navigation = navigationEvent(input, target);
      const id = `navigate-${index}-${target}`;
      bottom.push(actionButton({
        id, label: definition.projection === 'confirmation' ? 'Подтвердить' : 'Далее',
        ariaLabel: `Перейти к ${target}`, enabled: navigation.valid,
        action: factory(input).presentation(`navigate${index}`, { instanceId: id, ariaLabel: `Перейти к ${target}` }, navigation.event),
      }));
    });
  }
  if (SECTION03_BACK_REGISTRY[input.nodeId].kind !== 'terminal') {
    bottom.push(backButton(input, 'back', {}, 'scenario-back'));
  }
  return defineSection03ScreenProjection({
    nodeId: input.nodeId, ariaLabel: title, fixedTopTitle: title,
    bridgeProjection: { nodeId: input.nodeId, items: [...scroll, ...bottom] },
    slots: { fixedTop: [], scroll: scroll.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}
