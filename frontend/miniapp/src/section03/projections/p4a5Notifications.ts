import type { PresentationGraphBridgeItemInput } from '../../foundation/presentation';
import type {
  ManagerOpenTaskItem,
  ManagerOpenTasksResponse,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  section03NotificationTuple,
  type Section03ScreenProjection,
} from '../presentation';
import {
  backButton,
  factory,
  interaction,
  message,
  primary,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P4A5_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-NOT01',
] as const satisfies readonly Section03NodeId[]);

export type Section03P4A5SpecializedNodeId = typeof SECTION03_P4A5_SPECIALIZED_NODE_IDS[number];

export class Section03P4A5ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P4A5ProjectionError';
  }
}

function taskNavigation(task: ManagerOpenTaskItem): Readonly<{
  actionId: 'navigate0' | 'navigate1' | 'navigate2';
  event: Section03Context;
}> {
  if (task.target_screen_id === 'S03-AW10' && 'additional_work_id' in task.target_context) {
    return Object.freeze({
      actionId: 'navigate0',
      event: Object.freeze({
        additional_work_id: task.target_context.additional_work_id,
      }),
    });
  }
  if (task.target_screen_id === 'S03-AW50' && 'additional_work_id' in task.target_context) {
    return Object.freeze({
      actionId: 'navigate1',
      event: Object.freeze({
        additional_work_id: task.target_context.additional_work_id,
      }),
    });
  }
  if (task.target_screen_id === 'S03-M02' && 'machine_id' in task.target_context) {
    return Object.freeze({
      actionId: 'navigate2',
      event: Object.freeze({
        machine_id: task.target_context.machine_id,
      }),
    });
  }
  throw new Section03P4A5ProjectionError(`Invalid target contract for task ${task.task_id}.`);
}

function taskRow(
  input: P1NodeInput<'S03-NOT01'>,
  task: ManagerOpenTaskItem,
): PresentationGraphBridgeItemInput {
  const navigation = taskNavigation(task);
  const id = `task-${task.task_id}`;
  const mainLine = task.display_lines.join('\n');
  const ariaLabel = `Открыть задачу ${task.title}`;
  return Object.freeze({
    kind: 'state-list-button' as const,
    id,
    presentationAuthority: section03Authority(
      SECTION03_POLICY_ROOTS.backendNotificationList,
      section03NotificationTuple(task),
    ),
    interaction: interaction(factory(input).presentation(
      navigation.actionId,
      { instanceId: id, ariaLabel },
      navigation.event,
    )),
    mainLine: text(mainLine),
    ariaLabel,
  });
}

export function projectSection03P4A5(
  input: P1NodeInput<Section03P4A5SpecializedNodeId>,
): Section03ScreenProjection {
  if (input.nodeId !== 'S03-NOT01') {
    throw new Section03P4A5ProjectionError(`Unsupported P4A5 node ${input.nodeId}.`);
  }
  const model = primary(input) as unknown as ManagerOpenTasksResponse;
  const rows: PresentationGraphBridgeItemInput[] = model.tasks.map((task) => taskRow(input, task));
  if (rows.length === 0) rows.push(message('notifications-empty', 'Открытых задач нет.', SECTION03_POLICY_ROOTS.staticInfoMessage));
  const back = backButton(input, 'navigateBack0', {}, 'notifications-back');
  return defineSection03ScreenProjection({
    nodeId: 'S03-NOT01',
    ariaLabel: 'Уведомления',
    fixedTopTitle: 'Уведомления',
    bridgeProjection: { nodeId: 'S03-NOT01', items: [...rows, back] },
    slots: {
      fixedTop: [],
      scroll: rows.map((item) => item.id),
      fixedBottom: [back.id],
    },
  });
}
