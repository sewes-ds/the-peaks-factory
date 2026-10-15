import { describe, expect, it } from 'vitest';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../foundation/graphRuntime';
import {
  SECTION02_FIXTURE_CONTEXTS,
  createSection02FixtureApiClient,
} from './__fixtures__/section02Fixtures';
import {
  ADDITIONAL_WORK_START_BLOCKER_MESSAGES,
  type AdditionalWorkStartBlocker,
} from './contracts';
import { loadSection02Node } from './loaders';
import { createSection02ScreenProjection } from './projection';
import { createSection02Program } from './program';
import { createSection02RuntimeBinding } from './runtimeBinding';

const approved = (id: string, origin: 'OPERATOR_REQUEST_APPROVED' | 'MANAGER_ASSIGNED') => ({
  additional_work_id: id,
  additional_work_type_id: `TYPE-${id}`,
  display_name: `Работа ${id}`,
  origin,
  ui_group: 'APPROVED',
  ui_color_token: 'gray_green',
  action: 'START_ADDITIONAL_WORK',
});

const state = (group: 'approved' | 'pending' | 'active' | 'missing', id: string) => ({
  actor_employee_id: '201',
  active_additional_works: group === 'active' ? [{
    additional_work_id: id, additional_work_type_id: `TYPE-${id}`, display_name: `Работа ${id}`,
    ui_group: 'ACTIVE', ui_color_token: 'green', action: 'FINISH_ADDITIONAL_WORK',
  }] : [],
  approved_additional_works: group === 'approved' ? [approved(id, 'OPERATOR_REQUEST_APPROVED')] : [],
  pending_approval_additional_works: group === 'pending' ? [{
    additional_work_id: id, additional_work_type_id: `TYPE-${id}`, display_name: `Работа ${id}`,
    ui_group: 'PENDING_APPROVAL', ui_color_token: 'white_gray_inactive', action: null,
  }] : [],
});

type Case = Readonly<{
  name: string;
  nodeId: 'S02-AW03';
  selected: 'approved' | 'pending' | 'active' | 'missing';
  global: readonly AdditionalWorkStartBlocker[];
  pipeline?: boolean;
  expected: readonly AdditionalWorkStartBlocker[];
  start: boolean;
}>;

const cases: readonly Case[] = [
  { name: 'approved request', nodeId: 'S02-AW03', selected: 'approved', global: [], expected: [], start: true },
  { name: 'manager assignment', nodeId: 'S02-AW03', selected: 'approved', global: [], expected: [], start: true },
  { name: 'no shift', nodeId: 'S02-AW03', selected: 'approved', global: ['NO_OPEN_SHIFT'], expected: ['NO_OPEN_SHIFT'], start: false },
  { name: 'production', nodeId: 'S02-AW03', selected: 'approved', global: ['ACTIVE_PRODUCTION'], expected: ['ACTIVE_PRODUCTION'], start: false },
  { name: 'break', nodeId: 'S02-AW03', selected: 'approved', global: ['ACTIVE_BREAK'], expected: ['ACTIVE_BREAK'], start: false },
  { name: 'other additional work', nodeId: 'S02-AW03', selected: 'approved', global: ['OTHER_ADDITIONAL_WORK_RUNNING'], expected: ['OTHER_ADDITIONAL_WORK_RUNNING'], start: false },
  { name: 'all global blockers', nodeId: 'S02-AW03', selected: 'approved', global: ['NO_OPEN_SHIFT', 'ACTIVE_PRODUCTION', 'ACTIVE_BREAK', 'OTHER_ADDITIONAL_WORK_RUNNING'], expected: ['NO_OPEN_SHIFT', 'ACTIVE_PRODUCTION', 'ACTIVE_BREAK', 'OTHER_ADDITIONAL_WORK_RUNNING'], start: false },
  { name: 'pipeline absent', nodeId: 'S02-AW03', selected: 'approved', global: [], pipeline: false, expected: ['SELECTED_WORK_NOT_STARTABLE'], start: false },
  { name: 'pending selection', nodeId: 'S02-AW03', selected: 'pending', global: [], expected: ['SELECTED_WORK_NOT_APPROVED'], start: false },
  { name: 'already active selection', nodeId: 'S02-AW03', selected: 'active', global: [], expected: ['SELECTED_WORK_NOT_STARTABLE'], start: false },
  { name: 'missing selection', nodeId: 'S02-AW03', selected: 'missing', global: [], expected: ['SELECTED_WORK_NOT_STARTABLE'], start: false },
  { name: 'global before selected', nodeId: 'S02-AW03', selected: 'pending', global: ['ACTIVE_PRODUCTION', 'ACTIVE_BREAK'], expected: ['ACTIVE_PRODUCTION', 'ACTIVE_BREAK', 'SELECTED_WORK_NOT_APPROVED'], start: false },
  { name: 'manager assignment blocked', nodeId: 'S02-AW03', selected: 'approved', global: ['ACTIVE_PRODUCTION'], expected: ['ACTIVE_PRODUCTION'], start: false },
] as const;

async function projection(testCase: Case) {
  const id = testCase.name.startsWith('manager assignment') ? '73' : '72';
  const context = Object.freeze({
    ...SECTION02_FIXTURE_CONTEXTS[testCase.nodeId],
    additional_work_id: id,
    additional_work_type_id: `TYPE-${id}`,
    additional_work_name: `Работа ${id}`,
  });
  const apiClient = createSection02FixtureApiClient(testCase.nodeId, [], {
    additionalWorkStartBlockers: testCase.global,
    allowAdditionalWorkStart: testCase.pipeline !== false,
    additionalWorkStateOverride: state(testCase.selected, id),
  });
  const loaded = await loadSection02Node(apiClient, testCase.nodeId, context);
  const runtime = createGraphActivationRuntime(createSection02Program(apiClient));
  const ready = await runtime.activate({ nodeId: testCase.nodeId, context });
  if (ready.status !== 'ready') throw new Error(JSON.stringify(ready));
  const binding = createSection02RuntimeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: testCase.nodeId,
    onInteractionStateChange: () => undefined,
  });
  return {
    loaded,
    screen: createSection02ScreenProjection({
      nodeId: testCase.nodeId,
      ready,
      actionFactory: binding.actionFactory,
    }),
  };
}

describe('Section 02 additional-work start blockers', () => {
  it.each(cases)('$name keeps workplace authority over the selected row', async (testCase) => {
    const current = await projection(testCase);
    expect(current.loaded.additionalWorkStartBlockers).toEqual(testCase.expected);
    expect(current.loaded.availableActions.includes('START_ADDITIONAL_WORK')).toBe(testCase.start);
    expect(current.screen.bridgeProjection.items.map((item) => item.id)).toEqual([
      ...testCase.expected.map((_blocker, index) => `additional-work-start-blocker-${index}`),
      'additional-confirm-card',
      'additional-confirm',
      'additional-confirm-back',
    ]);
    const messages = current.screen.bridgeProjection.items
      .filter((item) => item.kind === 'message')
      .map((item) => item.kind === 'message' && item.content.kind === 'text' ? item.content.text : null);
    expect(messages).toEqual(testCase.expected.map((blocker) => ADDITIONAL_WORK_START_BLOCKER_MESSAGES[blocker]));
  });
});
