import type { PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type {
  ManagerAdditionalWorkAction,
  ManagerAdditionalWorkItem,
  ManagerAdditionalWorksResponse,
  ManagerAdditionalWorkStatus,
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

export const SECTION03_P3A2_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-AW20',
  'S03-AW21',
  'S03-AW30',
  'S03-AW31',
] as const satisfies readonly Section03NodeId[]);

export type Section03P3A2SpecializedNodeId =
  typeof SECTION03_P3A2_SPECIALIZED_NODE_IDS[number];

export class Section03P3A2SelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P3A2SelectionError';
  }
}

function model(input: P1NodeInput<Section03P3A2SpecializedNodeId>): ManagerAdditionalWorksResponse {
  return primary(input) as unknown as ManagerAdditionalWorksResponse;
}

function selectedLifecycleItem(
  input: P1NodeInput<Section03P3A2SpecializedNodeId>,
  status: ManagerAdditionalWorkStatus,
  action?: ManagerAdditionalWorkAction,
): ManagerAdditionalWorkItem {
  const workId = nodeData(input).context.additional_work_id;
  if (workId === undefined) throw new Section03P3A2SelectionError('Missing selected additional_work_id.');
  const selected = Object.values(model(input).groups).flat().find(
    (item) => item.additional_work_id === workId,
  );
  if (selected === undefined) throw new Section03P3A2SelectionError(`Selected additional work ${workId} is missing.`);
  if (selected.status !== status || selected.ui_state !== status) {
    throw new Section03P3A2SelectionError(`Selected additional work ${workId} is not ${status}.`);
  }
  if (action !== undefined && !hasAction(selected.available_actions, action)) {
    throw new Section03P3A2SelectionError(`Selected additional work ${workId} lacks ${action}.`);
  }
  return selected;
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function lifecycleCard(
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

function projectLifecycleCard(
  input: P1NodeInput<'S03-AW20'> | P1NodeInput<'S03-AW30'>,
): Section03ScreenProjection {
  const active = input.nodeId === 'S03-AW30';
  const item = selectedLifecycleItem(
    input as P1NodeInput<Section03P3A2SpecializedNodeId>,
    active ? 'active' : 'approved',
  );
  const authority: ManagerAdditionalWorkAction = active ? 'FINISH_ADDITIONAL_WORK' : 'CANCEL_ADDITIONAL_WORK';
  const label = active ? 'Завершить доп. работу' : 'Отменить';
  const event = Object.freeze({ additional_work_id: item.additional_work_id });
  const card: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: active ? 'additional-work-active-card' : 'additional-work-approved-card',
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendAdditionalWorkCard,
      section03AdditionalWorkTuple(item),
    ),
    lines: additionalWorkEntityLines({
      idPrefix: 'additional-work-lifecycle',
      employeeFullName: item.employee_full_name,
      additionalWorkName: item.additional_work_name,
    }),
    ariaLabel: active ? 'Активная доп. работа' : 'Согласованная доп. работа',
  });
  const open = actionButton({
    id: active ? 'additional-work-open-finish' : 'additional-work-open-cancel',
     label,
    ariaLabel: label,
    action: factory(input).presentation(
      'navigate0',
      {
        instanceId: active ? 'additional-work-open-finish' : 'additional-work-open-cancel',
        ariaLabel: label,
      },
      event,
    ),
    enabled: hasAction(item.available_actions, authority),
  });
  const back = backButton(input, 'navigateBack0', {}, 'additional-work-lifecycle-card-back');
  return defineSection03ScreenProjection({
    nodeId: input.nodeId,
    ariaLabel: active ? 'Активная доп. работа' : 'Согласованная доп. работа',
    bridgeProjection: { nodeId: input.nodeId, items: [card, open, back] },
    slots: { fixedTop: [], scroll: [card.id], fixedBottom: [open.id, back.id] },
  });
}

function projectLifecycleConfirmation(
  input: P1NodeInput<'S03-AW21'> | P1NodeInput<'S03-AW31'>,
): Section03ScreenProjection {
  const finish = input.nodeId === 'S03-AW31';
  const item = selectedLifecycleItem(
    input as P1NodeInput<Section03P3A2SpecializedNodeId>,
    finish ? 'active' : 'approved',
    finish ? 'FINISH_ADDITIONAL_WORK' : 'CANCEL_ADDITIONAL_WORK',
  );
  const label = finish ? 'Завершить доп. работу' : 'Отменить';
  const event = Object.freeze({ additional_work_id: item.additional_work_id });
  const card = lifecycleCard(
    finish ? 'additional-work-finish-card' : 'additional-work-cancel-card',
    finish ? SECTION03_POLICY_ROOTS.staticPositiveCard : SECTION03_POLICY_ROOTS.staticWarningCard,
    Object.freeze([
      contentOnly('additional-work-lifecycle-prompt', `Подтвердите действие: ${label}`),
      ...additionalWorkEntityLines({
        idPrefix: 'additional-work-lifecycle-confirm',
        employeeFullName: item.employee_full_name,
        additionalWorkName: item.additional_work_name,
      }),
    ]),
    `Подтверждение: ${label}`,
  );
  const projected = factory(input).business(
    finish ? 'FINISH_ADDITIONAL_WORK' : 'CANCEL_ADDITIONAL_WORK',
    {
      instanceId: finish ? 'additional-work-finish' : 'additional-work-cancel',
      ariaLabel: label,
    },
    event,
  );
  if (projected.length !== 1) {
    throw new Section03P3A2SelectionError(`Runtime denied selected additional work ${item.additional_work_id}.`);
  }
  const confirm = actionButton({
    id: finish ? 'additional-work-finish' : 'additional-work-cancel',
     label,
    ariaLabel: label,
    action: projected[0]!,
  });
  const back = backButton(input, 'navigateBack0', event, 'additional-work-lifecycle-confirm-back');
  return defineSection03ScreenProjection({
    nodeId: input.nodeId,
    ariaLabel: `Подтверждение: ${label}`,
    bridgeProjection: { nodeId: input.nodeId, items: [card, confirm, back] },
    slots: { fixedTop: [], scroll: [card.id], fixedBottom: [confirm.id, back.id] },
  });
}

export function projectSection03P3A2(
  input: P1NodeInput<Section03P3A2SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-AW20': return projectLifecycleCard(input as P1NodeInput<'S03-AW20'>);
    case 'S03-AW21': return projectLifecycleConfirmation(input as P1NodeInput<'S03-AW21'>);
    case 'S03-AW30': return projectLifecycleCard(input as P1NodeInput<'S03-AW30'>);
    case 'S03-AW31': return projectLifecycleConfirmation(input as P1NodeInput<'S03-AW31'>);
  }
}
