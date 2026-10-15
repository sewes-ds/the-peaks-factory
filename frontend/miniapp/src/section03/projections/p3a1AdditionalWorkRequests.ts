import type { PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
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
  inert,
  interaction,
  message,
  nodeData,
  primary,
  summaryLine,
  text,
  type P1NodeInput,
} from './common';
import { additionalWorkEntityLines } from './additionalWorkCardLines';

export const SECTION03_P3A1_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-AW01',
  'S03-AW10',
  'S03-AW11',
  'S03-AW12',
] as const satisfies readonly Section03NodeId[]);

export type Section03P3A1SpecializedNodeId =
  typeof SECTION03_P3A1_SPECIALIZED_NODE_IDS[number];

export class Section03P3A1SelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P3A1SelectionError';
  }
}

const groupSpecs = Object.freeze([
  Object.freeze({ status: 'requested' as const, heading: 'Запрошено', target: 'S03-AW10' as const, navigation: 'navigate0' }),
  Object.freeze({ status: 'approved' as const, heading: 'Согласовано', target: 'S03-AW20' as const, navigation: 'navigate1' }),
  Object.freeze({ status: 'active' as const, heading: 'В работе', target: 'S03-AW30' as const, navigation: 'navigate2' }),
  Object.freeze({ status: 'waiting_accrual' as const, heading: 'Требуют начисления', target: 'S03-AW50' as const, navigation: 'navigate4' }),
]);

function model(input: P1NodeInput<Section03P3A1SpecializedNodeId>): ManagerAdditionalWorksResponse {
  return primary(input) as unknown as ManagerAdditionalWorksResponse;
}

function selectedRequested(
  input: P1NodeInput<'S03-AW10' | 'S03-AW11' | 'S03-AW12'>,
): ManagerAdditionalWorkItem {
  const workId = nodeData(input).context.additional_work_id;
  if (workId === undefined) throw new Section03P3A1SelectionError('Missing selected additional_work_id.');
  const response = model(input);
  const selected = Object.values(response.groups).flat().find(
    (item) => item.additional_work_id === workId,
  );
  if (selected === undefined) throw new Section03P3A1SelectionError(`Selected additional work ${workId} is missing.`);
  if (selected.status !== 'requested' || selected.ui_state !== 'requested') {
    throw new Section03P3A1SelectionError(`Selected additional work ${workId} is not requested.`);
  }
  return selected;
}

function row(
  input: P1NodeInput<'S03-AW01'>,
  item: ManagerAdditionalWorkItem,
  navigation: string,
): PresentationGraphBridgeItemInput {
  const id = `aw-${item.additional_work_id}`;
  const label = `${item.employee_full_name}\n${item.additional_work_name}`;
  const enabled = hasAction(item.available_actions, 'OPEN_ADDITIONAL_WORK_CARD');
  return Object.freeze({
    kind: 'state-list-button' as const,
    id,
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendAdditionalWorkList,
      section03AdditionalWorkTuple(item),
    ),
    interaction: enabled
      ? interaction(factory(input).presentation(
          navigation,
          { instanceId: id, ariaLabel: `Открыть доп. работу ${item.additional_work_name}` },
          { additional_work_id: item.additional_work_id },
        ))
      : inert,
    mainLine: text(label),
    ariaLabel: enabled
      ? `Открыть доп. работу ${item.additional_work_name}`
      : `${label} — действие недоступно`,
  });
}

function projectOverview(input: P1NodeInput<'S03-AW01'>): Section03ScreenProjection {
  const response = model(input);
  const scroll: PresentationGraphBridgeItemInput[] = [];
  for (const spec of groupSpecs) {
    const items = response.groups[spec.status];
    scroll.push(summaryLine(`additional-work-group-${spec.status}`, spec.heading));
    if (items.length === 0) {
      scroll.push(message(
        `additional-work-group-${spec.status}-empty`,
        'Нет работ',
        SECTION03_POLICY_ROOTS.staticNeutralMessage,
      ));
    } else {
      scroll.push(...items.map((item) => row(input, item, spec.navigation)));
    }
  }
  const bottom: PresentationGraphBridgeItemInput[] = [];
  bottom.push(actionButton({
    id: 'additional-work-assign', label: 'Назначить доп. работу', ariaLabel: 'Назначить доп. работу',
    action: factory(input).presentation(
      'navigate3',
      { instanceId: 'additional-work-assign', ariaLabel: 'Назначить доп. работу' },
      {},
    ),
    enabled: hasAction(response.available_actions, 'ASSIGN_ADDITIONAL_WORK'),
  }));
  bottom.push(backButton(input, 'navigateBack0', {}, 'additional-works-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-AW01', ariaLabel: 'Доп. работы', fixedTopTitle: 'Доп. работы',
    bridgeProjection: { nodeId: 'S03-AW01', items: [...scroll, ...bottom] },
    slots: { fixedTop: [], scroll: scroll.map((item) => item.id), fixedBottom: bottom.map((item) => item.id) },
  });
}

function requestCard(
  id: string,
  rootId: string,
  lines: readonly PresentationGraphCardLineInput[],
  ariaLabel: string,
): PresentationGraphBridgeItemInput {
  return Object.freeze({
    kind: 'card' as const,
    id,
    presentationAuthority: section03Authority(rootId, null),
    lines,
    ariaLabel,
  });
}

function projectRequestedCard(input: P1NodeInput<'S03-AW10'>): Section03ScreenProjection {
  const item = selectedRequested(input);
  const event = { additional_work_id: item.additional_work_id };
  const backendCard: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'additional-work-request-card',
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendAdditionalWorkCard,
      section03AdditionalWorkTuple(item),
    ),
    lines: additionalWorkEntityLines({
      idPrefix: 'additional-work-request',
      employeeFullName: item.employee_full_name,
      additionalWorkName: item.additional_work_name,
    }),
    ariaLabel: 'Запрошенная доп. работа',
  });
  const bottom: PresentationGraphBridgeItemInput[] = [];
  bottom.push(actionButton({
    id: 'additional-work-request-open-approve',     label: 'Согласовать', ariaLabel: 'Согласовать',
    action: factory(input).presentation('navigate0', { instanceId: 'additional-work-request-open-approve', ariaLabel: 'Согласовать' }, event),
    enabled: hasAction(item.available_actions, 'APPROVE_ADDITIONAL_WORK_REQUEST'),
  }));
  bottom.push(actionButton({
    id: 'additional-work-request-open-reject',     label: 'Отклонить', ariaLabel: 'Отклонить',
    action: factory(input).presentation('navigate1', { instanceId: 'additional-work-request-open-reject', ariaLabel: 'Отклонить' }, event),
    enabled: hasAction(item.available_actions, 'REJECT_ADDITIONAL_WORK_REQUEST'),
  }));
  bottom.push(backButton(input, 'navigateBack0', {}, 'additional-work-request-back'));
  return defineSection03ScreenProjection({
    nodeId: 'S03-AW10', ariaLabel: 'Запрошенная доп. работа',
    bridgeProjection: { nodeId: 'S03-AW10', items: [backendCard, ...bottom] },
    slots: { fixedTop: [], scroll: [backendCard.id], fixedBottom: bottom.map((control) => control.id) },
  });
}

function projectDecision(
  input: P1NodeInput<'S03-AW11'> | P1NodeInput<'S03-AW12'>,
): Section03ScreenProjection {
  const item = selectedRequested(input);
  const approve = input.nodeId === 'S03-AW11';
  const authority = approve ? 'APPROVE_ADDITIONAL_WORK_REQUEST' : 'REJECT_ADDITIONAL_WORK_REQUEST';
  if (!hasAction(item.available_actions, authority)) {
    throw new Section03P3A1SelectionError(`Selected additional work ${item.additional_work_id} lacks ${authority}.`);
  }
  const label = approve ? 'Согласовать' : 'Отклонить';
  const prompt = message(
    approve ? 'additional-work-request-approve-prompt' : 'additional-work-request-reject-prompt',
    `Подтвердите действие: ${label}`,
    approve ? SECTION03_POLICY_ROOTS.staticPositiveMessage : SECTION03_POLICY_ROOTS.staticNeutralMessage,
  );
  const card = requestCard(
    approve ? 'additional-work-request-approve-card' : 'additional-work-request-reject-card',
    approve ? SECTION03_POLICY_ROOTS.staticPositiveCard : SECTION03_POLICY_ROOTS.staticNeutralCard,
    additionalWorkEntityLines({
      idPrefix: 'additional-work-request-decision',
      employeeFullName: item.employee_full_name,
      additionalWorkName: item.additional_work_name,
    }),
    `Подтверждение: ${label}`,
  );
  const event = { additional_work_id: item.additional_work_id };
  const actions = factory(input).business(
    approve ? 'APPROVE_ADDITIONAL_WORK' : 'REJECT_ADDITIONAL_WORK',
    { instanceId: approve ? 'additional-work-request-approve' : 'additional-work-request-reject', ariaLabel: label },
    event,
  );
  if (actions.length !== 1) {
    throw new Section03P3A1SelectionError(`Runtime denied selected additional work ${item.additional_work_id}.`);
  }
  const confirm = actionButton({
    id: approve ? 'additional-work-request-approve' : 'additional-work-request-reject',
 label, ariaLabel: label,
    action: actions[0]!,
  });
  const back = backButton(input, 'navigateBack0', event, 'additional-work-request-decision-back');
  return defineSection03ScreenProjection({
    nodeId: input.nodeId, ariaLabel: `Подтверждение: ${label}`,
    bridgeProjection: { nodeId: input.nodeId, items: [prompt, card, confirm, back] },
    slots: { fixedTop: [], scroll: [prompt.id, card.id], fixedBottom: [confirm.id, back.id] },
  });
}

export function projectSection03P3A1(
  input: P1NodeInput<Section03P3A1SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-AW01': return projectOverview(input as P1NodeInput<'S03-AW01'>);
    case 'S03-AW10': return projectRequestedCard(input as P1NodeInput<'S03-AW10'>);
    case 'S03-AW11': return projectDecision(input as P1NodeInput<'S03-AW11'>);
    case 'S03-AW12': return projectDecision(input as P1NodeInput<'S03-AW12'>);
  }
}
