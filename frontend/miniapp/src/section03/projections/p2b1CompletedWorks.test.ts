import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
} from '../../foundation/graphRuntime';
import {
  decodeManagerCompletedWorkCardResponse,
  decodeManagerCompletedWorksResponse,
  type ManagerCompletedWorkCardResponse,
  type ManagerCompletedWorksResponse,
} from '../contracts';
import {
  SECTION03_P2B1_EMPLOYEE_FIXTURE_ALIASES,
  SECTION03_P2B1_FIXTURES,
  SECTION03_P2B1_FIXTURE_IDS,
  type Section03P2B1Fixture,
} from '../fixtures/p2b1CompletedWorks';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { section03ProjectionStateKeys, section03VisibleJson } from '../testPresentation';
import { projectSection03Generic } from './generic';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';
import { SECTION03_P2A2A_SPECIALIZED_NODE_IDS } from './p2a2aShiftClose';
import { SECTION03_P2A2B_SPECIALIZED_NODE_IDS } from './p2a2bBlockers';
import {
  SECTION03_P2B1_SPECIALIZED_NODE_IDS,
  Section03P2B1IdentityError,
} from './p2b1CompletedWorks';

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function projectFixture(fixture: Section03P2B1Fixture) {
  const requests: Array<Readonly<{ method: string; path: string }>> = [];
  const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(request));
    requests.push(Object.freeze({
      method: init?.method ?? 'GET',
      path: `${url.pathname}${url.search}`,
    }));
    return fixture.apiResponse === null
      ? response({ error: 'unexpected request' })
      : response(fixture.apiResponse);
  });
  const runtime = createGraphActivationRuntime(
    createSection03Program(new ApiClient({
      baseUrl: 'https://fixture.test',
      fetchImpl,
    })),
  );
  const ready = await runtime.activate({
    nodeId: fixture.nodeId,
    context: fixture.context,
  });
  if (ready.status !== 'ready') {
    throw new Error(`${fixture.fixtureId}: ${JSON.stringify(ready)}`);
  }
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: fixture.nodeId,
    onInteractionStateChange: () => undefined,
  });
  const createProjection = () => createSection03ScreenProjection({
    nodeId: fixture.nodeId,
    ready,
    actionFactory: binding.actionFactory,
  } as never);
  return { createProjection, requests, runtime };
}

type Action = Readonly<{
  actionId?: string;
  event?: Readonly<Record<string, unknown>>;
}>;

function actions(projection: ReturnType<typeof createSection03ScreenProjection>) {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Action]
      : []);
}

function forwardActions(
  fixture: Section03P2B1Fixture,
  projected: ReturnType<typeof createSection03ScreenProjection>,
) {
  return actions(projected).filter((action) => action.actionId?.startsWith('navigate'))
    .filter((action) => !action.actionId?.startsWith('navigateBack'))
    .map((action) => {
      const index = Number(action.actionId?.slice('navigate'.length));
      return Object.freeze({
        target: SECTION03_FORWARD_TARGETS[fixture.nodeId][index],
        event: action.event,
      });
    });
}

function visibleProjection(
  projection: ReturnType<typeof createSection03ScreenProjection>,
): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel,
    fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...visible } = item;
      return visible;
    }),
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const mixed = SECTION03_P2B1_FIXTURES.find(
  (fixture) => fixture.fixtureId === 'S03-E21:mixed-production-additional',
)!.apiResponse as ManagerCompletedWorksResponse;
const productionCard = SECTION03_P2B1_FIXTURES.find(
  (fixture) => fixture.fixtureId === 'S03-E22:production-all-actions',
)!.apiResponse as ManagerCompletedWorkCardResponse;

describe('Section 03 P2B1 completed-work contracts and projections', () => {
  it('resolves the current-worker alias to canonical EMP-1 without serializing the alias', async () => {
    const selected = SECTION03_P2B1_EMPLOYEE_FIXTURE_ALIASES['EMP-CW'];
    expect(selected.employee_id).toBe('EMP-1');
    expect(Object.isFrozen(SECTION03_P2B1_EMPLOYEE_FIXTURE_ALIASES)).toBe(true);
    expect(Object.isFrozen(selected)).toBe(true);

    const fixture = SECTION03_P2B1_FIXTURES.find(
      (candidate) => candidate.fixtureId === 'S03-E21:mixed-production-additional',
    )!;
    const target = await projectFixture(fixture);
    const projection = target.createProjection();
    expect(JSON.stringify(fixture.apiResponse)).not.toContain('EMP-CW');
    expect(JSON.stringify(projection)).not.toContain('EMP-CW');
    expect(forwardActions(fixture, projection).every(
      (navigation) => navigation.event?.employee_id === 'EMP-1',
    )).toBe(true);
    expect(target.requests).toEqual([{
      method: 'GET',
      path: '/manager/employees/EMP-1/completed-works?period=today&type=all',
    }]);
  });

  it('decodes complete production/additional items, nulls and frozen string values', () => {
    const decoded = decodeManagerCompletedWorksResponse(mixed);
    expect(decoded.works.map((work) => work.work_type)).toEqual([
      'production', 'additional_work',
    ]);
    expect(decoded.works[0]).toMatchObject({
      quantity: '12.5', salary_amount_uzs: '125000',
    });
    expect(decoded.works[1]).toMatchObject({
      production_operation_id: null, machine_id: null, quantity: null,
    });
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.employee)).toBe(true);
    expect(Object.isFrozen(decoded.works)).toBe(true);
    expect(decoded.works.every(Object.isFrozen)).toBe(true);
    const card = decodeManagerCompletedWorkCardResponse(productionCard);
    expect(Object.isFrozen(card)).toBe(true);
    expect(Object.isFrozen(card.work)).toBe(true);
    expect(Object.isFrozen(card.available_actions)).toBe(true);
  });

  it('normalizes IDs and rejects invalid types, booleans, screens and actions', () => {
    const numeric = clone(mixed) as unknown as { works: Array<Record<string, unknown>> };
    numeric.works[0]!.work_item_id = 42;
    numeric.works[0]!.operation_id = 77;
    expect(decodeManagerCompletedWorksResponse(numeric).works[0]).toMatchObject({
      work_item_id: '42', operation_id: '77',
    });
    const invalidWorkType = clone(mixed) as unknown as { works: Array<Record<string, unknown>> };
    invalidWorkType.works[0]!.work_type = 'other';
    expect(() => decodeManagerCompletedWorksResponse(invalidWorkType)).toThrow();
    const invalidBoolean = clone(productionCard) as unknown as { work: Record<string, unknown> };
    invalidBoolean.work.can_correct = 1;
    expect(() => decodeManagerCompletedWorkCardResponse(invalidBoolean)).toThrow();
    const invalidScreen = { ...clone(mixed), screen: 'S03-E20' };
    expect(() => decodeManagerCompletedWorksResponse(invalidScreen)).toThrow();
    for (const available_actions of [[], ['OPEN'], ['BACK', 'BACK']]) {
      expect(() => decodeManagerCompletedWorksResponse({
        ...clone(mixed), available_actions,
      })).toThrow();
    }
    expect(() => decodeManagerCompletedWorksResponse({
      ...clone(mixed), works: 'invalid',
    })).toThrow();
  });

  it('owns the exact three-node tuple and leaves 47 diagnostic nodes', () => {
    expect(SECTION03_P2B1_SPECIALIZED_NODE_IDS).toEqual([
      'S03-E20', 'S03-E21', 'S03-E22',
    ]);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(20);
    const specialized = new Set<string>([
      ...prior, ...SECTION03_P2B1_SPECIALIZED_NODE_IDS,
    ]);
    expect(specialized.size).toBe(23);
    expect(SECTION03_NODE_IDS.filter((id) => !specialized.has(id)))
      .toHaveLength(47);
    for (const nodeId of specialized) {
      expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
    }
  });

  it('owns exactly 17 immutable explicit fixtures', () => {
    expect(SECTION03_P2B1_FIXTURES).toHaveLength(17);
    expect(new Set(SECTION03_P2B1_FIXTURE_IDS).size).toBe(17);
    expect(Object.fromEntries(SECTION03_P2B1_SPECIALIZED_NODE_IDS.map(
      (nodeId) => [
        nodeId,
        SECTION03_P2B1_FIXTURES.filter((fixture) => fixture.nodeId === nodeId).length,
      ],
    ))).toEqual({ 'S03-E20': 1, 'S03-E21': 6, 'S03-E22': 10 });
    for (const fixture of SECTION03_P2B1_FIXTURES) {
      expect(Object.isFrozen(fixture)).toBe(true);
      expect(fixture.fixtureId.startsWith(`${fixture.nodeId}:`)).toBe(true);
    }
  });

  it('projects every valid fixture with exact order, text, states and scalar navigation', async () => {
    for (const fixture of SECTION03_P2B1_FIXTURES) {
      const target = await projectFixture(fixture);
      if (fixture.expectProjectionFailure) {
        expect(target.createProjection, fixture.fixtureId)
          .toThrow(Section03P2B1IdentityError);
        continue;
      }
      const projection = target.createProjection();
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId)
        .toEqual(fixture.orderedItemIds);
      const visible = visibleProjection(projection).replaceAll('\\n', '\n');
      for (const value of fixture.visibleText) {
        expect(visible, `${fixture.fixtureId}: ${value}`).toContain(value);
      }
      for (const value of fixture.absentText) {
        expect(visible, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      }
      const stateKeys = section03ProjectionStateKeys(
        projection.bridgeProjection.items,
      );
      expect(stateKeys, fixture.fixtureId).toEqual(fixture.expectedStateKeys);
      expect(forwardActions(fixture, projection), fixture.fixtureId)
        .toEqual(fixture.expectedNavigations);
      expect(actions(projection).every((action) =>
        action.event === undefined || Object.values(action.event).every((value) =>
          typeof value === 'string' || typeof value === 'number'))).toBe(true);
      expect(target.requests, fixture.fixtureId).toEqual(
        fixture.exactRequestPath === null
          ? []
          : [{ method: 'GET', path: fixture.exactRequestPath }],
      );
      expect(target.requests.some((request) => request.method !== 'GET')).toBe(false);
    }
  });

  it('uses exact period events, fixed Back routes and no E20 request', async () => {
    const fixture = SECTION03_P2B1_FIXTURES[0];
    const target = await projectFixture(fixture);
    const projection = target.createProjection();
    expect(forwardActions(fixture, projection).map((item) => item.event)).toEqual([
      { employee_id: 'EMP-1', period: 'today' },
      { employee_id: 'EMP-1', period: 'week' },
      { employee_id: 'EMP-1', period: 'month' },
      { employee_id: 'EMP-1', period: 'last_30_days' },
    ]);
    expect(target.requests).toEqual([]);
    expect(SECTION03_BACK_REGISTRY['S03-E20']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-E21']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-E22']).toEqual({ kind: 'history' });
  });

  it('fails closed on list item and card work identity mismatches', async () => {
    const listResponse = clone(mixed) as unknown as { works: Array<Record<string, unknown>> };
    listResponse.works[0]!.employee_id = 'EMP-OTHER';
    const listFixture = {
      ...SECTION03_P2B1_FIXTURES[1], apiResponse: listResponse,
    } as unknown as Section03P2B1Fixture;
    expect((await projectFixture(listFixture)).createProjection)
      .toThrow(Section03P2B1IdentityError);
    const cardResponse = clone(productionCard) as unknown as { work: Record<string, unknown> };
    cardResponse.work.employee_id = 'EMP-OTHER';
    const cardFixture = {
      ...SECTION03_P2B1_FIXTURES[7], apiResponse: cardResponse,
    } as unknown as Section03P2B1Fixture;
    expect((await projectFixture(cardFixture)).createProjection)
      .toThrow(Section03P2B1IdentityError);
  });

  it('publishes E22 reachability in exact navigation-only order', () => {
    expect(SECTION03_FORWARD_TARGETS['S03-E22']).toEqual([
      'S03-CP13', 'S03-CF24',
    ]);
  });

  it('keeps correction and storno positions but disables both outside Today', async () => {
    const base = SECTION03_P2B1_FIXTURES.find(
      (item) => item.fixtureId === 'S03-E22:production-all-actions',
    )!;
    const past = await projectFixture({
      ...base,
      fixtureId: 'S03-E22:production-past-period',
      context: { ...base.context, period: 'month' },
    } as Section03P2B1Fixture);
    const projection = past.createProjection();
    for (const id of ['completed-work-correction', 'completed-work-storno']) {
      expect(projection.bridgeProjection.items.find((item) => item.id === id))
        .toMatchObject({ interaction: { kind: 'action', baseAvailability: 'disabled' } });
    }
  });
});
