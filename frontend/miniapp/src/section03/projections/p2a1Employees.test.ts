import { describe, expect, it } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
} from '../../foundation/graphRuntime';
import {
  SECTION03_P2A1_FIXTURES,
  SECTION03_P2A1_FIXTURE_IDS,
} from '../fixtures/p2a1Employees';
import { createSection03Program } from '../program';
import { SECTION03_NODE_IDS } from '../program/ids';
import { validateSection03NodeContext } from '../program/registry';
import { createSection03ScreenProjection } from '../projection';
import {
  section03ProjectionControlKeys,
  section03ProjectionStateKeys,
  section03VisibleJson,
} from '../testPresentation';
import { projectSection03Generic } from './generic';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';

type Fixture = typeof SECTION03_P2A1_FIXTURES[number];

async function projectFixture(fixture: Fixture) {
  const apiClient = new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: async (request) => {
      const path = new URL(String(request)).pathname;
      const value = fixture.apiResponses[path];
      return new Response(JSON.stringify(value ?? { error: path }), {
        status: value === undefined ? 404 : 200,
      });
    },
  });
  const runtime = createGraphActivationRuntime(
    createSection03Program(apiClient),
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
  return createSection03ScreenProjection({
    nodeId: fixture.nodeId,
    ready,
    actionFactory: binding.actionFactory,
  } as never);
}

function actionIds(projection: Awaited<ReturnType<typeof projectFixture>>) {
  return projection.bridgeProjection.items.flatMap((item) => {
    if (!('interaction' in item) || item.interaction.kind !== 'action') return [];
    const actionId = (item.interaction.action as Readonly<{ actionId?: string }>).actionId;
    return actionId === undefined ? [] : [actionId];
  });
}

describe('Section 03 P2A1 employee projections', () => {
  it('owns the exact ordered three-node set and leaves 56 generic nodes', () => {
    expect(SECTION03_P2A1_SPECIALIZED_NODE_IDS).toEqual([
      'S03-E01', 'S03-E02', 'S03-E12',
    ]);
    const specialized = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
    ]);
    expect(SECTION03_NODE_IDS.filter((id) => !specialized.has(id)))
      .toHaveLength(56);
  });

  it('makes the generic projection unreachable for every P2A1 node', () => {
    for (const nodeId of SECTION03_P2A1_SPECIALIZED_NODE_IDS) {
      expect(() => projectSection03Generic({ nodeId } as never))
        .toThrow(`P2A1 node ${nodeId} cannot reach generic projection.`);
    }
  });

  it('owns 18 immutable, individually expected fixtures', () => {
    expect(SECTION03_P2A1_FIXTURES).toHaveLength(18);
    expect(new Set(SECTION03_P2A1_FIXTURE_IDS).size).toBe(18);
    expect(new Set(SECTION03_P2A1_FIXTURES.map((fixture) => fixture.nodeId)))
      .toEqual(new Set(SECTION03_P2A1_SPECIALIZED_NODE_IDS));
    for (const fixture of SECTION03_P2A1_FIXTURES) {
      expect(() => validateSection03NodeContext(fixture.nodeId, fixture.context))
        .not.toThrow();
      expect(Object.isFrozen(fixture)).toBe(true);
      expect(Object.isFrozen(fixture.apiResponses)).toBe(true);
      expect(Object.isFrozen(fixture.expectedTargets)).toBe(true);
      expect(fixture.fixtureId.startsWith(`${fixture.nodeId}:`)).toBe(true);
    }
  });

  it('projects every fixture with exact item, state, control and action order', async () => {
    for (const fixture of SECTION03_P2A1_FIXTURES) {
      const projection = await projectFixture(fixture);
      const items = projection.bridgeProjection.items;
      expect(items.map((item) => item.id), fixture.fixtureId)
        .toEqual(fixture.orderedItemIds);
      expect(section03ProjectionStateKeys(items), fixture.fixtureId)
        .toEqual(fixture.stateKeys);
      expect(section03ProjectionControlKeys(items), fixture.fixtureId)
        .toEqual(fixture.controlKeys);
      expect(actionIds(projection), fixture.fixtureId)
        .toEqual(fixture.expectedActionIds);

      const serialized = JSON.stringify(projection);
      const visibleEvidence = section03VisibleJson({
        ariaLabel: projection.ariaLabel,
        fixedTopTitle: projection.fixedTopTitle,
        items: items.map((item) => {
          if (!('interaction' in item)) return item;
          const { interaction: _interaction, ...visible } = item;
          return visible;
        }),
      });
      for (const value of fixture.visibleText) {
        expect(visibleEvidence, `${fixture.fixtureId}: ${value}`).toContain(value);
      }
      for (const value of fixture.absentText) {
        expect(visibleEvidence, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      }
      expect(serialized, fixture.fixtureId).not.toContain('scenario-card');
      expect(serialized, fixture.fixtureId).not.toContain('Сценарий');
    }
  });

  it('preserves exact E02 mixed line order and content-only structure', async () => {
    const fixture = SECTION03_P2A1_FIXTURES.find(
      (value) => value.fixtureId === 'S03-E02:all-activity-fields',
    );
    if (fixture === undefined) throw new Error('missing all-activity fixture');
    const projection = await projectFixture(fixture);
    const card = projection.bridgeProjection.items[0];
    if (card?.kind !== 'card') throw new Error('missing employee card');
    expect(card.lines.map((line) => line.id)).toEqual([
      'employee-name', 'shift-start', 'employee-sku', 'employee-machine',
      'employee-downtime', 'downtime-comment', 'production-start',
      'downtime-start', 'downtime-duration', 'employee-break', 'break-start',
      'break-duration', 'employee-additional-work', 'additional-work-start',
      'additional-work-duration',
    ]);
    for (const id of [
      'employee-downtime', 'employee-break', 'employee-additional-work',
    ]) {
      const line = card.lines.find((value) => value.id === id);
      expect(line).toHaveProperty('content');
      expect(line).not.toHaveProperty('label');
      expect(line).not.toHaveProperty('value');
    }
  });

  it('records exact forward and Back targets for every authored variant', () => {
    const actionTarget: Readonly<Record<string, Readonly<Record<string, string>>>> = {
      'S03-E01': { navigate0: 'S03-E02', navigateBack0: 'S03-N01' },
      'S03-E02': {
        navigate0: 'S03-E12', navigate1: 'S03-E10', navigate2: 'S03-E20',
        navigate3: 'S03-SAL01', navigateBack0: 'S03-E01',
      },
      'S03-E12': {
        navigate0: 'S03-E13', navigate1: 'S03-E16', navigate2: 'S03-E17',
        navigateBack0: 'S03-E02',
      },
    };
    const itemAction: Readonly<Record<string, Readonly<Record<string, string>>>> = {
      'S03-E02': {
        'employee-salary': 'navigate3',
        'employee-completed-works': 'navigate2',
        'employee-finish-shift': 'navigate0-or-navigate1',
      },
      'S03-E12': {
        'blocker-production': 'navigate0',
        'blocker-break': 'navigate1',
        'blocker-additional-work': 'navigate2',
      },
    };
    for (const fixture of SECTION03_P2A1_FIXTURES) {
      expect(actionTarget[fixture.nodeId]?.navigateBack0, fixture.fixtureId)
        .toBe(fixture.expectedBack);
      for (const expectation of fixture.expectedTargets) {
        let actionId = fixture.nodeId === 'S03-E01'
          ? 'navigate0'
          : itemAction[fixture.nodeId]?.[expectation.itemId];
        if (actionId === 'navigate0-or-navigate1') {
          actionId = expectation.target === 'S03-E12' ? 'navigate0' : 'navigate1';
        }
        expect(actionTarget[fixture.nodeId]?.[actionId!], fixture.fixtureId)
          .toBe(expectation.target);
      }
    }
  });

});
