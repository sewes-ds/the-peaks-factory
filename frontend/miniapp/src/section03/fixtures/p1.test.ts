import { describe, expect, it } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import type { PresentationFormDraftController } from '../../foundation/presentation';
import { createSection03Program } from '../program';
import { SECTION03_NODE_IDS } from '../program/ids';
import { validateSection03NodeContext } from '../program/registry';
import { section03FormFields } from '../presentation';
import { createSection03ScreenProjection } from '../projection';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from '../projections/p1';
import { SECTION03_P1_FIXTURES, SECTION03_P1_FIXTURE_IDS } from './p1';

function formController(fieldId: 'comment_finish' | 'comment_start', value: string): PresentationFormDraftController {
  const valid = value.trim().length > 0;
  return Object.freeze({
    activationKey: 'fixture', fieldIds: Object.freeze([fieldId]), valid,
    field: () => { throw new Error('fixture form rendering is covered by the DOM gate'); },
    setValue: () => undefined, reset: () => undefined,
    commit: () => valid ? Object.freeze({ [fieldId]: value.trim() }) : (() => { throw new Error('invalid'); })(),
  });
}

async function projectFixture(fixture: typeof SECTION03_P1_FIXTURES[number]) {
  const apiClient = new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: async (request) => {
      const path = new URL(String(request)).pathname;
      const value = fixture.apiResponses[path];
      return new Response(JSON.stringify(value ?? { error: path }), { status: value === undefined ? 404 : 200 });
    },
  });
  const program = createSection03Program(apiClient);
  const runtime = createGraphActivationRuntime(program);
  const ready = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
  if (ready.status !== 'ready') throw new Error(`${fixture.fixtureId}: ${JSON.stringify(ready)}`);
  const binding = createPeaksGraphReadyNodeBinding({
    runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: fixture.nodeId, onInteractionStateChange: () => undefined,
  });
  const fieldId = fixture.nodeId === 'S03-M03C' ? 'comment_finish' : fixture.nodeId === 'S03-D12' ? 'comment_start' : null;
  const form = fieldId === null ? undefined : formController(fieldId, String(fixture.context[fieldId] ?? ''));
  return createSection03ScreenProjection({
    nodeId: fixture.nodeId, ready, actionFactory: binding.actionFactory,
    ...(form === undefined ? {} : { formController: form }),
  } as never);
}

describe('Section 03 P1 individually authored fixtures', () => {
  it('owns the exact mandatory variant set with valid scalar context', () => {
    expect(SECTION03_P1_FIXTURES).toHaveLength(39);
    expect(new Set(SECTION03_P1_FIXTURE_IDS).size).toBe(39);
    expect(new Set(SECTION03_P1_FIXTURES.map((item) => item.nodeId)))
      .toEqual(new Set(SECTION03_P1_SPECIALIZED_NODE_IDS));
    for (const item of SECTION03_P1_FIXTURES) {
      expect(item.fixtureId.startsWith(`${item.nodeId}:`)).toBe(true);
      expect(() => validateSection03NodeContext(item.nodeId, item.context)).not.toThrow();
      expect(Object.keys(item.apiResponses).every((path) => path.startsWith('/'))).toBe(true);
      expect(item.orderedItemIds.length).toBeGreaterThan(0);
      expect(Object.isFrozen(item.absentText)).toBe(true);
    }
  });

  it('records non-empty action expectations and exact business bodies', () => {
    expect(SECTION03_P1_FIXTURES.filter((item) => item.expectedActionIds.length > 0).length)
      .toBeGreaterThan(30);
    const business = SECTION03_P1_FIXTURES.filter((item) => item.expectedBusiness !== null);
    expect(business.map((item) => item.fixtureId)).toEqual([
      'S03-M03O:valid-operational',
      'S03-M03O:critical-start-follow-up',
      'S03-M04C:valid-critical',
      'S03-M04C:pending-duplicate',
      'S03-D13:active-production-operation',
      'S03-D13:no-production-operation',
      'S03-D13:pending-duplicate',
    ]);
    expect(business[0]?.expectedBusiness?.body).toEqual({
      comment: 'Завершено начальником производства',
      reason: 'Завершено начальником производства',
    });
    expect(business[2]?.expectedBusiness?.body).toEqual({
      comment: 'Проверенный комментарий',
      reason: 'Проверенный комментарий',
    });
    expect(business[4]?.expectedBusiness?.body).toEqual({
      machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT',
      production_operation_id: 'PO-1', comment: 'Причина остановки',
    });
  });

  it('leaves exactly the other 59 nodes on generic diagnostic fixtures', () => {
    const remaining = SECTION03_NODE_IDS.filter(
      (nodeId) => !(SECTION03_P1_SPECIALIZED_NODE_IDS as readonly string[]).includes(nodeId),
    );
    expect(remaining).toHaveLength(59);
  });

  it('projects every authored variant with exact order, actions, title and visible evidence', async () => {
    for (const fixture of SECTION03_P1_FIXTURES) {
      const projection = await projectFixture(fixture);
      expect(projection.fixedTopTitle ?? null, fixture.fixtureId).toBe(fixture.expectedTitle);
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId)
        .toEqual(fixture.orderedItemIds);
      const serialized = JSON.stringify(projection);
      const visibleEvidence = `${serialized}${JSON.stringify(section03FormFields(fixture.nodeId))}`;
      for (const value of fixture.visibleText) {
        expect(visibleEvidence, `${fixture.fixtureId}: ${value}`).toContain(value);
      }
      for (const value of fixture.absentText ?? []) {
        expect(visibleEvidence, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      }
      const actionIds = [...new Set(projection.bridgeProjection.items.flatMap((item) => {
        if (!('interaction' in item) || item.interaction.kind !== 'action') return [];
        const actionId = (item.interaction.action as Readonly<{ actionId?: string }>).actionId;
        return actionId === undefined ? [] : [actionId];
      }))];
      expect(actionIds, fixture.fixtureId).toEqual(fixture.expectedActionIds);
      expect(serialized, fixture.fixtureId).not.toContain('scenario-card');
      expect(serialized, fixture.fixtureId).not.toContain('Подтвердить</');
    }
  });

  it('owns exact no-comment machine-card negative evidence', () => {
    const fixture = SECTION03_P1_FIXTURES.find((item) => item.fixtureId === 'S03-M02:critical-downtime-no-comment');
    expect(fixture).toMatchObject({
      nodeId: 'S03-M02',
      expectedBack: 'S03-M01',
      expectedNext: 'S03-M03C',
      expectedActionIds: ['p1OpenCriticalFinish', 'p1BackToMachineList'],
      stateKeys: ['state-danger'],
      absentText: ['Комментарий', '—'],
    });
  });
});
