import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import { decodeManagerOpenTasksResponse } from '../contracts';
import {
  SECTION03_P4A5_FIXTURES,
  SECTION03_P4A5_FIXTURE_IDS,
  type Section03P4A5Fixture,
} from '../fixtures/p4a5Notifications';
import { P3A4_WAITING_RESPONSE } from '../fixtures/p3a4AdditionalWorkAccrual';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { section03ProjectionStateKeys, section03VisibleJson } from '../testPresentation';
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
import { SECTION03_P4A2_SPECIALIZED_NODE_IDS } from './p4a2FinancialCorrectionCreate';
import { SECTION03_P4A3_SPECIALIZED_NODE_IDS } from './p4a3FinancialCorrectionReversal';
import { SECTION03_P4A4_SPECIALIZED_NODE_IDS } from './p4a4ProductionCorrection';
import { SECTION03_P4A5_SPECIALIZED_NODE_IDS } from './p4a5Notifications';

type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

async function target(fixture: Section03P4A5Fixture) {
  const requests: Array<Readonly<{ method: string; path: string }>> = [];
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(request));
      requests.push(Object.freeze({ method: init?.method ?? 'GET', path: url.pathname }));
      return new Response(JSON.stringify(
        url.pathname === '/manager/additional-works'
          ? P3A4_WAITING_RESPONSE
          : fixture.apiResponse,
      ), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }),
  })));
  const ready = await runtime.activate({ nodeId: 'S03-NOT01', context: fixture.context });
  if (ready.status !== 'ready') return { ready, project: undefined, requests, runtime } as const;
  if (ready.nodeId !== 'S03-NOT01') throw new Error(`Unexpected ready node ${ready.nodeId}.`);
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: 'S03-NOT01',
    onInteractionStateChange: () => undefined,
  });
  const project = () => createSection03ScreenProjection({
    nodeId: 'S03-NOT01', ready: ready as never, actionFactory: binding.actionFactory,
  });
  return { ready, binding, project, requests, runtime } as const;
}

function actions(projection: ReturnType<typeof createSection03ScreenProjection>): readonly Action[] {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Action]
      : []);
}

function deepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
}

describe('Section 03 P4A5 notifications', () => {
  const renderable = SECTION03_P4A5_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure);
  const failures = SECTION03_P4A5_FIXTURES.filter((fixture) => fixture.expectProjectionFailure);

  it('owns exactly NOT01 after 63 prior nodes and leaves R01 first planned', () => {
    expect(SECTION03_P4A5_SPECIALIZED_NODE_IDS).toEqual(['S03-NOT01']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A3_SPECIALIZED_NODE_IDS, ...SECTION03_P3A4_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A1_SPECIALIZED_NODE_IDS, ...SECTION03_P4A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A3_SPECIALIZED_NODE_IDS, ...SECTION03_P4A4_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(63);
    expect(prior.has('S03-NOT01')).toBe(false);
    const specialized = new Set([...prior, ...SECTION03_P4A5_SPECIALIZED_NODE_IDS]);
    expect(specialized.size).toBe(64);
    expect(SECTION03_NODE_IDS.find((nodeId) => !specialized.has(nodeId))).toBe('S03-R01');
  });

  it('keeps the exact program, loader, forward, Back and read-only contracts', () => {
    expect(SECTION03_NODE_REGISTRY['S03-NOT01']).toMatchObject({
      loader: 'notifications', requiredContext: [], projection: 'list',
    });
    expect(SECTION03_FORWARD_TARGETS['S03-NOT01']).toEqual(['S03-AW10', 'S03-AW50', 'S03-M02']);
    expect(SECTION03_BACK_REGISTRY['S03-NOT01']).toEqual({ kind: 'history' });
    expect(SECTION03_BUSINESS_ACTIONS.filter((action) => action.nodes.includes('S03-NOT01'))).toEqual([]);
  });

  it('owns the complete deeply immutable fixture registry', () => {
    expect(SECTION03_P4A5_FIXTURES).toHaveLength(23);
    expect(SECTION03_P4A5_FIXTURE_IDS).toEqual(SECTION03_P4A5_FIXTURES.map((fixture) => fixture.fixtureId));
    expect(new Set(SECTION03_P4A5_FIXTURE_IDS).size).toBe(23);
    expect(renderable).toHaveLength(8);
    expect(failures).toHaveLength(15);
    expect(deepFrozen(SECTION03_P4A5_FIXTURES)).toBe(true);
  });

  it('decodes exact four semantic matrices, equivalence, count and identities', () => {
    const representative = renderable[0]!;
    const decoded = decodeManagerOpenTasksResponse(representative.apiResponse);
    expect(decoded.tasks.map((task) => [
      task.task_kind, task.target_screen_id, task.ui_color_token, task.ui_variant, task.task_type,
    ])).toEqual([
      ['ADDITIONAL_WORK_WAITING_ACCRUAL', 'S03-AW50', 'green', 'green', 'additional_work_waiting_accrual'],
      ['ADDITIONAL_WORK_REQUESTED', 'S03-AW10', 'gray', 'grey', 'additional_work_request'],
      ['OPERATIONAL_DOWNTIME_OVER_15_MIN', 'S03-M02', 'yellow', 'yellow', 'open_machine_downtime'],
      ['CRITICAL_DOWNTIME_OPEN', 'S03-M02', 'red', 'red', 'open_machine_downtime'],
    ]);
    expect(decoded.tasks).toEqual(decoded.open_tasks);
    expect(decoded.open_tasks_count).toBe(decoded.tasks.length);
    expect(new Set(decoded.tasks.map((task) => task.task_id)).size).toBe(decoded.tasks.length);
    expect(new Set(decoded.tasks.map((task) => task.notification_id)).size).toBe(decoded.tasks.length);
  });

  it('locks exact Owner display lines and excludes hidden work names and downtime class phrases', () => {
    const decoded = decodeManagerOpenTasksResponse(renderable[0]!.apiResponse);
    expect(decoded.tasks.map((task) => [task.task_kind, task.display_lines])).toEqual([
      ['ADDITIONAL_WORK_WAITING_ACCRUAL', ['Доп. работа требует начисления', 'Илья Серов']],
      ['ADDITIONAL_WORK_REQUESTED', ['Запрошена доп. работа', 'Анна Ким']],
      ['OPERATIONAL_DOWNTIME_OVER_15_MIN', ['Ожидание материала', 'Станок операционного простоя', '00:17']],
      ['CRITICAL_DOWNTIME_OPEN', ['Поломка шпинделя', 'Станок критического простоя', '00:34']],
    ]);
    expect(JSON.stringify(decoded.tasks.map((task) => task.display_lines))).not.toMatch(
      /Проверить комплектность|Сверить оснастку|Операционный простой больше 15 минут|Критический простой/,
    );
  });

  it('projects every valid fixture in backend order with exact tones/actions/events and Back', async () => {
    for (const fixture of renderable) {
      const current = await target(fixture);
      expect(current.ready.status, fixture.fixtureId).toBe('ready');
      if (current.project === undefined) throw new Error(`Expected renderable ${fixture.fixtureId}.`);
      const projection = current.project();
      expect(projection.fixedTopTitle, fixture.fixtureId).toBe('Уведомления');
      expect(projection.ariaLabel, fixture.fixtureId).toBe('Уведомления');
      expect(projection.slots.fixedTop, fixture.fixtureId).toEqual([]);
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId)
        .toEqual(fixture.expectedStateKeys);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      expect(actions(projection).map((action) => action.event), fixture.fixtureId).toEqual(fixture.expectedEvents);
      const visible = section03VisibleJson(projection.bridgeProjection.items.map((item) => {
        if (!('interaction' in item)) return item;
        const { interaction: _interaction, ...rest } = item;
        return rest;
      }));
      fixture.visibleText.forEach((text) => expect(visible, `${fixture.fixtureId}: ${text}`).toContain(text));
      expect(current.requests).toEqual([{ method: 'GET', path: '/manager/notifications/open-tasks' }]);
    }
  });

  it('rebuilds exact scalar task events and ignores residual route context', async () => {
    const fixture = {
      ...renderable[0]!,
      context: Object.freeze({
        machine_id: 'STALE', additional_work_id: 'STALE', employee_id: 'STALE', refresh_nonce: 7,
      }),
    };
    const current = await target(fixture);
    if (current.project === undefined) throw new Error('Expected ready notification projection.');
    expect(actions(current.project()).slice(0, 4).map((action) => action.event)).toEqual(fixture.expectedEvents.slice(0, 4));
  });

  it('executes the registered waiting target action as S03-AW50', async () => {
    const current = await target(renderable[0]!);
    if (current.project === undefined || !('binding' in current)) throw new Error('Expected ready notification projection.');
    const waiting = actions(current.project())[0]!;
    expect(waiting.actionId).toBe('navigate1');
    const result = await current.binding.execute(waiting as never);
    expect(result.kind === 'presentation' && result.result.status === 'ready'
      ? result.result.activation.nodeId
      : null).toBe('S03-AW50');
  });

  it('fails closed for all malformed fixtures before projection and performs no mutation', async () => {
    for (const fixture of failures) {
      const current = await target(fixture);
      expect(current.ready.status, fixture.fixtureId).toBe('error');
      expect(current.requests, fixture.fixtureId).toEqual([{ method: 'GET', path: '/manager/notifications/open-tasks' }]);
      expect(current.requests.some((request) => request.method !== 'GET'), fixture.fixtureId).toBe(false);
    }
  });
});
