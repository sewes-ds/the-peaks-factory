import type {
  ManagerOpenTaskItem,
  ManagerOpenTaskKind,
  ManagerOpenTasksResponse,
} from '../contracts';
import type { Section03Context } from '../program/context';

export type Section03P4A5Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-NOT01';
  context: Section03Context;
  apiResponse: unknown;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedEvents: readonly Readonly<Record<string, string>>[];
  expectProjectionFailure: boolean;
}>;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const semantics = Object.freeze({
  ADDITIONAL_WORK_REQUESTED: Object.freeze({
    target_screen_id: 'S03-AW10', target_context: { additional_work_id: 'REQ-1' },
    ui_color_token: 'gray', ui_variant: 'grey', task_type: 'additional_work_request',
    source_table: 'additional_works', entity_table: 'additional_works',
    title: 'Запрошена доп. работа', display_lines: ['Запрошена доп. работа', 'Анна Ким'],
  }),
  ADDITIONAL_WORK_WAITING_ACCRUAL: Object.freeze({
    target_screen_id: 'S03-AW50', target_context: { additional_work_id: 'WAIT-1' },
    ui_color_token: 'green', ui_variant: 'green', task_type: 'additional_work_waiting_accrual',
    source_table: 'additional_works', entity_table: 'additional_works',
    title: 'Доп. работа требует начисления', display_lines: ['Доп. работа требует начисления', 'Илья Серов'],
  }),
  CRITICAL_DOWNTIME_OPEN: Object.freeze({
    target_screen_id: 'S03-M02', target_context: { machine_id: 'M-CRIT' },
    ui_color_token: 'red', ui_variant: 'red', task_type: 'open_machine_downtime',
    source_table: 'machine_downtimes', entity_table: 'machine_downtimes',
    title: 'Критический простой', display_lines: ['Поломка шпинделя', 'Станок критического простоя', '00:34'],
  }),
  OPERATIONAL_DOWNTIME_OVER_15_MIN: Object.freeze({
    target_screen_id: 'S03-M02', target_context: { machine_id: 'M-OP' },
    ui_color_token: 'yellow', ui_variant: 'yellow', task_type: 'open_machine_downtime',
    source_table: 'machine_downtimes', entity_table: 'machine_downtimes',
    title: 'Операционный простой больше 15 минут', display_lines: ['Ожидание материала', 'Станок операционного простоя', '00:17'],
  }),
} as const);

function task(
  kind: ManagerOpenTaskKind,
  suffix: string,
  overrides: Readonly<Record<string, unknown>> = {},
): ManagerOpenTaskItem {
  const spec = semantics[kind];
  return deepFreeze({
    task_id: `NOT-TASK-${suffix}`,
    notification_id: `NOTIFICATION-${suffix}`,
    created_at: `2026-08-04 0${suffix.length}:00:00+03`,
    task_kind: kind,
    entity_table: spec.entity_table,
    entity_id: Object.values(spec.target_context)[0],
    sort_group: suffix.length,
    sort_started_at: `2026-08-04 0${suffix.length}:00:00+03`,
    ui_color_token: spec.ui_color_token,
    target_screen_id: spec.target_screen_id,
    target_context: { ...spec.target_context },
    display_lines: [...spec.display_lines],
    source_table: spec.source_table,
    source_id: Object.values(spec.target_context)[0],
    task_type: spec.task_type,
    title: spec.title,
    description: null,
    ui_state: 'open',
    ui_variant: spec.ui_variant,
    available_actions: ['OPEN_TASK_SOURCE'],
    ...overrides,
  }) as ManagerOpenTaskItem;
}

const requested = task('ADDITIONAL_WORK_REQUESTED', 'REQ');
const waiting = task('ADDITIONAL_WORK_WAITING_ACCRUAL', 'WAIT');
const critical = task('CRITICAL_DOWNTIME_OPEN', 'CRIT');
const operational = task('OPERATIONAL_DOWNTIME_OVER_15_MIN', 'OP');

function response(tasks: readonly ManagerOpenTaskItem[]): ManagerOpenTasksResponse {
  return deepFreeze({
    section: 'S03', screen: 'S03-NOT01', title: 'Уведомления',
    tasks: tasks.map((item) => ({ ...item, target_context: { ...item.target_context }, display_lines: [...item.display_lines], available_actions: [...item.available_actions] })),
    open_tasks: tasks.map((item) => ({ ...item, target_context: { ...item.target_context }, display_lines: [...item.display_lines], available_actions: [...item.available_actions] })),
    open_tasks_count: tasks.length,
    available_actions: ['BACK'],
  }) as ManagerOpenTasksResponse;
}

export const P4A5_NOTIFICATIONS_ALL_RESPONSE = response([waiting, requested, operational, critical]);
export const P4A5_NOTIFICATIONS_EMPTY_RESPONSE = response([]);
export const P4A5_NOTIFICATIONS_REQUESTED_RESPONSE = response([requested]);
export const P4A5_NOTIFICATIONS_WAITING_RESPONSE = response([waiting]);
export const P4A5_NOTIFICATIONS_CRITICAL_RESPONSE = response([critical]);
export const P4A5_NOTIFICATIONS_OPERATIONAL_RESPONSE = response([operational]);
export const P4A5_NOTIFICATIONS_LONG_RESPONSE = response([task('ADDITIONAL_WORK_REQUESTED', 'LONG', {
  display_lines: [
    'Запрошена доп. работа',
    'Сотрудник с очень длинным полным именем для проверки многострочного отображения',
  ],
})]);
export const P4A5_NOTIFICATIONS_REPEATED_TARGET_RESPONSE = response([
  requested,
  task('ADDITIONAL_WORK_REQUESTED', 'REQ2', {
    target_context: { additional_work_id: 'REQ-2' },
    entity_id: 'REQ-2', source_id: 'REQ-2',
  }),
]);

function fixture(input: Omit<Section03P4A5Fixture, 'nodeId' | 'context'> & Partial<Pick<Section03P4A5Fixture, 'context'>>): Section03P4A5Fixture {
  return deepFreeze({ nodeId: 'S03-NOT01', context: {}, ...input });
}

function valid(
  fixtureId: string,
  apiResponse: ManagerOpenTasksResponse,
  visibleText: readonly string[],
  states: readonly string[],
  actionIds: readonly string[],
  events: readonly Readonly<Record<string, string>>[],
): Section03P4A5Fixture {
  return fixture({
    fixtureId, apiResponse,
    orderedItemIds: [
      ...(apiResponse.tasks.length === 0
        ? ['notifications-empty']
        : apiResponse.tasks.map((item) => `task-${item.task_id}`)),
      'notifications-back',
    ],
    visibleText: [...visibleText, 'Назад'], expectedStateKeys: states,
    expectedActionIds: [...actionIds, 'navigateBack0'], expectedEvents: [...events, {}],
    expectProjectionFailure: false,
  });
}

const requestedEvent = { additional_work_id: 'REQ-1' };
const waitingEvent = { additional_work_id: 'WAIT-1' };
const criticalEvent = { machine_id: 'M-CRIT' };
const operationalEvent = { machine_id: 'M-OP' };

const validFixtures = [
  valid('S03-NOT01:representative-all-kinds', P4A5_NOTIFICATIONS_ALL_RESPONSE,
    ['Доп. работа требует начисления', 'Запрошена доп. работа', 'Ожидание материала', '00:17', 'Поломка шпинделя', '00:34'],
    ['state-positive', 'state-neutral', 'state-warning', 'state-danger'],
    ['navigate1', 'navigate0', 'navigate2', 'navigate2'],
    [waitingEvent, requestedEvent, operationalEvent, criticalEvent]),
  valid('S03-NOT01:empty', P4A5_NOTIFICATIONS_EMPTY_RESPONSE, ['Открытых задач нет.'], ['state-info'], [], []),
  valid('S03-NOT01:requested-only', P4A5_NOTIFICATIONS_REQUESTED_RESPONSE, ['Запрошена доп. работа'], ['state-neutral'], ['navigate0'], [requestedEvent]),
  valid('S03-NOT01:waiting-accrual-only', P4A5_NOTIFICATIONS_WAITING_RESPONSE, ['Доп. работа требует начисления'], ['state-positive'], ['navigate1'], [waitingEvent]),
  valid('S03-NOT01:critical-downtime-only', P4A5_NOTIFICATIONS_CRITICAL_RESPONSE, ['Поломка шпинделя', 'Станок критического простоя', '00:34'], ['state-danger'], ['navigate2'], [criticalEvent]),
  valid('S03-NOT01:operational-downtime-only', P4A5_NOTIFICATIONS_OPERATIONAL_RESPONSE, ['Ожидание материала', 'Станок операционного простоя', '00:17'], ['state-warning'], ['navigate2'], [operationalEvent]),
  valid('S03-NOT01:long-multiline-content', P4A5_NOTIFICATIONS_LONG_RESPONSE, ['Запрошена доп. работа', 'очень длинным'], ['state-neutral'], ['navigate0'], [{ ...requestedEvent }]),
  valid('S03-NOT01:repeated-target-distinct-task-ids', P4A5_NOTIFICATIONS_REPEATED_TARGET_RESPONSE, ['Запрошена доп. работа'], ['state-neutral', 'state-neutral'], ['navigate0', 'navigate0'], [requestedEvent, { ...requestedEvent, additional_work_id: 'REQ-2' }]),
];

function invalid(fixtureId: string, apiResponse: unknown): Section03P4A5Fixture {
  return fixture({ fixtureId, apiResponse, orderedItemIds: [], visibleText: [], expectedStateKeys: [], expectedActionIds: [], expectedEvents: [], expectProjectionFailure: true });
}

const clone = <T>(value: T): T => structuredClone(value);
const mutate = (mutator: (value: Record<string, unknown>) => void): unknown => {
  const value = clone(P4A5_NOTIFICATIONS_REQUESTED_RESPONSE) as unknown as Record<string, unknown>;
  mutator(value);
  return value;
};
const taskAt = (value: Record<string, unknown>, list: 'tasks' | 'open_tasks' = 'tasks') =>
  (value[list] as Array<Record<string, unknown>>)[0]!;

const invalidFixtures = [
  invalid('S03-NOT01:duplicate-task-id', response([requested, task('ADDITIONAL_WORK_WAITING_ACCRUAL', 'REQ', { notification_id: 'NOTIFICATION-OTHER' })])),
  invalid('S03-NOT01:duplicate-notification-id', response([requested, task('ADDITIONAL_WORK_WAITING_ACCRUAL', 'OTHER', { notification_id: requested.notification_id })])),
  invalid('S03-NOT01:count-mismatch', mutate((value) => { value.open_tasks_count = 2; })),
  invalid('S03-NOT01:open-tasks-reordered', { ...clone(P4A5_NOTIFICATIONS_ALL_RESPONSE), open_tasks: [...clone(P4A5_NOTIFICATIONS_ALL_RESPONSE.open_tasks)].reverse() }),
  invalid('S03-NOT01:open-tasks-content-mismatch', mutate((value) => { taskAt(value, 'open_tasks').title = 'Другая задача'; })),
  invalid('S03-NOT01:kind-target-mismatch', mutate((value) => { taskAt(value).target_screen_id = 'S03-M02'; })),
  invalid('S03-NOT01:kind-color-mismatch', mutate((value) => { taskAt(value).ui_color_token = 'red'; })),
  invalid('S03-NOT01:color-variant-mismatch', mutate((value) => { taskAt(value).ui_variant = 'red'; })),
  invalid('S03-NOT01:kind-task-type-mismatch', mutate((value) => { taskAt(value).task_type = 'unknown'; })),
  invalid('S03-NOT01:extra-target-context-field', mutate((value) => { (taskAt(value).target_context as Record<string, unknown>).machine_id = 'M-EXTRA'; })),
  invalid('S03-NOT01:missing-required-target-id', mutate((value) => { (taskAt(value).target_context as Record<string, unknown>).additional_work_id = null; })),
  invalid('S03-NOT01:empty-display-lines', mutate((value) => { taskAt(value).display_lines = []; })),
  invalid('S03-NOT01:extra-task-field', mutate((value) => { taskAt(value).test_marker = true; })),
  invalid('S03-NOT01:invalid-task-action', mutate((value) => { taskAt(value).available_actions = ['BACK']; })),
  invalid('S03-NOT01:invalid-response-action', mutate((value) => { value.available_actions = ['OPEN_TASK_SOURCE']; })),
];

export const SECTION03_P4A5_FIXTURES = deepFreeze([...validFixtures, ...invalidFixtures]);
export const SECTION03_P4A5_FIXTURE_IDS = deepFreeze(SECTION03_P4A5_FIXTURES.map((item) => item.fixtureId));

export const P4A5_BROWSER_RESPONSES = deepFreeze({
  all: P4A5_NOTIFICATIONS_ALL_RESPONSE,
  empty: P4A5_NOTIFICATIONS_EMPTY_RESPONSE,
  requested: P4A5_NOTIFICATIONS_REQUESTED_RESPONSE,
  waiting: P4A5_NOTIFICATIONS_WAITING_RESPONSE,
  critical: P4A5_NOTIFICATIONS_CRITICAL_RESPONSE,
  operational: P4A5_NOTIFICATIONS_OPERATIONAL_RESPONSE,
});
