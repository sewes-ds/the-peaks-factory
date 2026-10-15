import type {
  GraphActionInstanceCommonInput,
} from '../../foundation/graphProtocol';
import type {
  GraphActivationReadyState,
  GraphReadyNodeActionFactory,
} from '../../foundation/graphRuntime';
import type {
  PresentationFormDraftController,
  PresentationGraphBridgeItemInput,
  PresentationGraphContentInput,
  ControlSemanticKey,
} from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import {
  isSection03NodeProjection,
  type Section03NodeId,
  type Section03Program,
} from '../program';
import type { Section03Context } from '../program/context';
import type { Section03LoadedNodeData } from '../program/loaders';
import type { Section03ReadRecord, Section03ReadValue } from '../readModels';
import {
  section03Authority,
} from '../presentation/sectionAuthority';
import {
  resolveSection03ActionRole,
} from '../presentation/actionPolicy';
import { section03ActionAuthority } from '../presentation/sectionAuthority';
import { SECTION03_POLICY_ROOTS } from '../presentation/sectionPolicy';

export type P1NodeInput<N extends Section03NodeId = Section03NodeId> = Readonly<{
  nodeId: N;
  ready: GraphActivationReadyState<N>;
  actionFactory: GraphReadyNodeActionFactory<Section03Program, N>;
  formController?: PresentationFormDraftController;
}>;

export const inert = Object.freeze({ kind: 'inert' as const });

export type RuntimeActionFactory = Readonly<{
  business: (
    actionId: string,
    input: GraphActionInstanceCommonInput,
    event: Section03Context,
  ) => readonly object[];
  presentation: (
    actionId: string,
    input: GraphActionInstanceCommonInput,
    event: Section03Context,
  ) => object;
}>;

export function factory(input: P1NodeInput): RuntimeActionFactory {
  return input.actionFactory as unknown as RuntimeActionFactory;
}

export function readyProjection(input: P1NodeInput) {
  if (!isSection03NodeProjection(input.ready.projection)) {
    throw new Error(`Invalid Section 03 projection for ${input.nodeId}.`);
  }
  return input.ready.projection;
}

export function context(input: P1NodeInput): Section03Context {
  return input.ready.context as Section03Context;
}

export function text(value: string): PresentationGraphContentInput {
  return Object.freeze({ kind: 'text' as const, text: value });
}

export function interaction(value: object, enabled = true) {
  return Object.freeze({
    kind: 'action' as const,
    action: value,
    baseAvailability: enabled ? 'enabled' as const : 'disabled' as const,
  });
}

export function actionButton(input: Readonly<{
  id: string;
  label: string;
  ariaLabel: string;
  action: object;
  enabled?: boolean;
}>): PresentationGraphBridgeItemInput {
  const resolvedRole = resolveSection03ActionRole(input.action);
  return Object.freeze({
    kind: 'control-action-button' as const,
    id: input.id,
    presentationAuthority: section03ActionAuthority(resolvedRole, 'action-button'),
    interaction: interaction(input.action, input.enabled ?? true),
    label: text(input.label),
    ariaLabel: input.ariaLabel,
  });
}

export function inertActionButton(input: Readonly<{
  id: string;
  label: string;
  ariaLabel: string;
  role: ControlSemanticKey;
}>): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'control-action-button' as const,
    id: input.id,
    presentationAuthority: section03ActionAuthority(input.role, 'action-button'),
    interaction: inert,
    label: text(input.label),
    ariaLabel: input.ariaLabel,
  });
}

export function backButton(
  input: P1NodeInput,
  actionId: string,
  event: Section03Context,
  id: string,
): PresentationGraphBridgeItemInput {
  return actionButton({
    id,
    label: 'Назад',
    ariaLabel: 'Назад',
    action: factory(input).presentation(actionId, { instanceId: id, ariaLabel: 'Назад' }, event),
  });
}

export function message(
  id: string,
  value: string,
  rootId: string,
): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'message' as const,
    id,
    presentationAuthority: section03Authority(rootId, null),
    content: text(value),
  });
}

export function summaryLine(id: string, value: string): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'summary-line' as const,
    id,
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticInfoSummary, null),
    content: text(value),
  });
}

export function cardLine(
  id: string,
  label: string,
  value: PresentationGraphContentInput | null,
): readonly PresentationGraphCardLineInput[] {
  return value === null ? Object.freeze([]) : Object.freeze([Object.freeze({ id, label: text(label), value })]);
}

export function hasAction(actions: readonly string[], actionId: string): boolean {
  return actions.includes(actionId);
}

export function nodeData(input: P1NodeInput): Readonly<{
  context: Section03Context;
  data: Section03LoadedNodeData;
}> {
  const projection = readyProjection(input);
  if (projection.kind !== 'section03-node' || projection.screenId !== input.nodeId) {
    throw new Error(`Expected owned Section 03 node data for ${input.nodeId}.`);
  }
  return Object.freeze({ context: projection.context, data: projection.data });
}

export function record(value: Section03ReadValue | null | undefined, path: string): Section03ReadRecord {
  if (value === undefined || value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`Expected object at ${path}.`);
  }
  return value as Section03ReadRecord;
}

export function array(value: Section03ReadValue | undefined, path: string): readonly Section03ReadValue[] {
  if (!Array.isArray(value)) throw new Error(`Expected array at ${path}.`);
  return value;
}

export function requiredText(value: Section03ReadValue | undefined, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Expected text at ${path}.`);
  return value.trim();
}

export function optionalText(value: Section03ReadValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function bool(value: Section03ReadValue | undefined): boolean {
  return value === true;
}

export function availableActions(value: Section03ReadValue | undefined): readonly string[] {
  return Array.isArray(value)
    ? Object.freeze(value.filter((item): item is string => typeof item === 'string'))
    : Object.freeze([]);
}

export function primary(input: P1NodeInput): Section03ReadRecord {
  const data = nodeData(input).data.primary;
  if (data === null) throw new Error(`Missing primary data for ${input.nodeId}.`);
  return data;
}
