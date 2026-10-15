import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { section03ResolvedAppearanceKey, section03VisibleJson } from '../testPresentation';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
} from '../../foundation/graphRuntime';
import type { PresentationFormDraftController } from '../../foundation/presentation';
import {
  SECTION03_P2A2A_FIXTURES,
  SECTION03_P2A2A_FIXTURE_IDS,
  type Section03P2A2aFixture,
} from '../fixtures/p2a2aShiftClose';
import { createSection03Program } from '../program';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { validateSection03NodeContext } from '../program/registry';
import { createSection03ScreenProjection } from '../projection';
import { section03FormFields } from '../presentation';
import { projectSection03Generic } from './generic';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';
import { SECTION03_P2A2A_SPECIALIZED_NODE_IDS } from './p2a2aShiftClose';

function controller(
  value: string,
  pending = false,
): PresentationFormDraftController {
  const normalized = value.trim();
  const valid = normalized.length >= 1;
  return {
    activationKey: 'fixture',
    fieldIds: Object.freeze(['shift_finish_reason']),
    field: () => ({
      definition: section03FormFields('S03-E10')[0]!,
      value,
      validation: {
        valid,
        code: valid ? null : 'REQUIRED',
        normalizedValue: normalized,
      },
      disabled: false,
      pending,
    }),
    setValue: () => undefined,
    reset: () => undefined,
    valid,
    commit: () => {
      if (pending) throw Object.freeze({ code: 'FORM_PENDING' });
      if (!valid) throw Object.freeze({ code: 'FORM_INVALID' });
      return Object.freeze({ shift_finish_reason: normalized });
    },
  };
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function projectFixture(
  fixture: Section03P2A2aFixture,
  options: Readonly<{ pending?: boolean }> = {},
) {
  const calls: Array<Readonly<{ method: string; path: string; body: unknown }>> = [];
  const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(request)).pathname;
    const method = init?.method ?? 'GET';
    calls.push(Object.freeze({
      method,
      path,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    }));
    if (method === 'POST') {
      return fixture.requestFailure
        ? response({ error: 'close failed' }, 503)
        : response({ id: 'SHIFT-CLOSED' });
    }
    if (path === '/manager/employees') {
      return response({
        section: 'S03', screen: 'S03-E01', title: 'Сотрудники',
        employees: [], available_actions: ['BACK'],
      });
    }
    const value = fixture.apiResponses[path];
    return value === undefined
      ? response({ error: path }, 404)
      : response(value);
  });
  const runtime = createGraphActivationRuntime(
    createSection03Program(new ApiClient({
      baseUrl: 'https://fixture.test',
      fetchImpl,
    })),
  );
  const presentationExecution = createGraphPresentationExecutionRuntime(runtime);
  const ready = await runtime.activate({
    nodeId: fixture.nodeId,
    context: fixture.context,
  });
  if (ready.status !== 'ready') {
    throw new Error(`${fixture.fixtureId}: ${JSON.stringify(ready)}`);
  }
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution,
    nodeId: fixture.nodeId,
    onInteractionStateChange: () => undefined,
  });
  const projection = createSection03ScreenProjection({
    nodeId: fixture.nodeId,
    ready,
    actionFactory: binding.actionFactory,
    ...(fixture.nodeId === 'S03-E10'
      ? { formController: controller(fixture.formValue ?? '', options.pending) }
      : {}),
  } as never);
  return { binding, calls, projection, runtime };
}

function actions(
  projection: Awaited<ReturnType<typeof projectFixture>>['projection'],
) {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Readonly<{
          actionId?: string;
          event?: Readonly<Record<string, unknown>>;
        }>]
      : []);
}

function visibleProjection(
  projection: Awaited<ReturnType<typeof projectFixture>>['projection'],
): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel,
    fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (item.kind === 'form-field') {
        return {
          ...item,
          controller: item.controller.field(item.fieldId),
        };
      }
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...visible } = item;
      return visible;
    }),
  });
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('Section 03 P2A2a employee shift close projections', () => {
  it('owns the exact ordered two-node set and leaves 54 diagnostic nodes', () => {
    expect(SECTION03_P2A2A_SPECIALIZED_NODE_IDS).toEqual([
      'S03-E10', 'S03-E11',
    ]);
    const specialized = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS,
    ]);
    expect(specialized.size).toBe(16);
    expect(SECTION03_NODE_IDS.filter((id) => !specialized.has(id)))
      .toHaveLength(54);
  });

  it('makes the generic projection unreachable for all 16 specialized nodes', () => {
    for (const nodeId of [
      ...SECTION03_P1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS,
    ]) {
      expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
    }
  });

  it('owns exactly nine explicit immutable fixtures', () => {
    expect(SECTION03_P2A2A_FIXTURES).toHaveLength(9);
    expect(new Set(SECTION03_P2A2A_FIXTURE_IDS).size).toBe(9);
    for (const fixture of SECTION03_P2A2A_FIXTURES) {
      expect(() => validateSection03NodeContext(fixture.nodeId, fixture.context))
        .not.toThrow();
      expect(Object.isFrozen(fixture)).toBe(true);
      expect(Object.isFrozen(fixture.employeeCardResponse)).toBe(true);
      expect(Object.isFrozen(fixture.apiResponses)).toBe(true);
      expect(fixture.employeeCardResponse).toBe(
        Object.values(fixture.apiResponses)[0],
      );
      expect(fixture.expectedBack).toBe(
        fixture.nodeId === 'S03-E10' ? 'S03-E02' : 'S03-E10',
      );
    }
  });

  it('projects exact item, visible text, absence and action order for every fixture', async () => {
    for (const fixture of SECTION03_P2A2A_FIXTURES) {
      const { projection } = await projectFixture(fixture, {
        pending: fixture.pending && fixture.nodeId === 'S03-E10',
      });
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId)
        .toEqual(fixture.orderedItemIds);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId)
        .toEqual(fixture.expectedActionIds);
      const visible = visibleProjection(projection);
      for (const text of fixture.visibleText) {
        expect(visible, `${fixture.fixtureId}: ${text}`).toContain(text);
      }
      for (const text of fixture.absentText) {
        expect(visible, `${fixture.fixtureId}: ${text}`).not.toContain(text);
      }
    }
  });

  it('defines the exact global E10 multiline field and trims only valid input', async () => {
    expect(section03FormFields('S03-E10')).toEqual([{
      id: 'shift_finish_reason',
      kind: 'multiline',
      label: 'Причина завершения смены',
      accessibilityLabel: 'Причина завершения смены',
      required: true,
      minLength: 1,
    }]);
    for (const fixtureId of ['S03-E10:empty', 'S03-E10:whitespace']) {
      const fixture = SECTION03_P2A2A_FIXTURES.find((item) => item.fixtureId === fixtureId)!;
      const { projection } = await projectFixture(fixture);
      const next = projection.bridgeProjection.items.find((item) => item.id === 'shift-close-next');
      expect(next).toMatchObject({
        interaction: { kind: 'action', baseAvailability: 'disabled' },
      });
    }
    const fixture = SECTION03_P2A2A_FIXTURES.find((item) => item.fixtureId === 'S03-E10:valid')!;
    const { projection } = await projectFixture(fixture);
    const next = actions(projection).find((action) => action.actionId === 'navigate0');
    expect(next?.event).toEqual({
      employee_id: 'EMP-SHIFT-CLOSE',
      shift_finish_reason: 'Смена завершена по просьбе сотрудника',
    });
  });

  it('keeps pending form navigation disabled without committing a pending draft', async () => {
    const fixture = SECTION03_P2A2A_FIXTURES.find((item) => item.fixtureId === 'S03-E10:valid')!;
    const { projection } = await projectFixture(fixture, { pending: true });
    expect(projection.bridgeProjection.items.find((item) => item.id === 'shift-close-next'))
      .toMatchObject({ interaction: { baseAvailability: 'disabled' } });
  });

  it('renders one danger confirmation card with exactly three ordered legacy lines', async () => {
    const fixture = SECTION03_P2A2A_FIXTURES.find((item) => item.fixtureId === 'S03-E11:valid-authorized')!;
    const { projection } = await projectFixture(fixture);
    expect(projection.fixedTopTitle).toBeUndefined();
    const card = projection.bridgeProjection.items[0];
    expect(card).toMatchObject({
      kind: 'card',
      lines: [
        { id: 'shift-close-prompt', content: { text: 'Подтвердите завершение смены:' } },
        { id: 'shift-close-employee', label: { text: 'Сотрудник' }, value: { text: 'Петров Пётр Петрович' } },
        { id: 'shift-close-reason', label: { text: 'Комментарий' }, value: { text: 'Смена завершена по просьбе сотрудника' } },
      ],
    });
    expect(section03ResolvedAppearanceKey(card!)).toBe('state-danger');
    expect(JSON.stringify(card)).not.toContain('employee_id');
    expect(JSON.stringify(card)).not.toContain('shift_finish_reason');
  });

  it('enforces employee authority and exact Back/Next metadata', async () => {
    const unauthorized = SECTION03_P2A2A_FIXTURES.find((item) => item.fixtureId === 'S03-E11:unauthorized')!;
    expect((await projectFixture(unauthorized)).projection.slots.fixedBottom)
      .toEqual(['shift-close-confirm', 'shift-close-confirmation-back']);
    expect(SECTION03_FORWARD_TARGETS['S03-E10']).toEqual(['S03-E11']);
    expect(SECTION03_FORWARD_TARGETS['S03-E11']).toEqual(['S03-E01']);
  });

  it('posts one exact trimmed close request and reaches E01 on success', async () => {
    const fixture = SECTION03_P2A2A_FIXTURES.find((item) => item.fixtureId === 'S03-E11:valid-authorized')!;
    const target = await projectFixture(fixture);
    const close = actions(target.projection).find((action) =>
      action.actionId === 'CLOSE_EMPLOYEE_SHIFT');
    if (close === undefined) throw new Error('missing close action');
    const result = await target.binding.execute(close as never);
    expect(result.kind === 'business' && result.result.status === 'ready'
      ? result.result.activation.nodeId
      : null).toBe('S03-E01');
    expect(target.calls.filter((call) => call.method === 'POST')).toEqual([{
      method: 'POST',
      path: '/shifts/EMP-SHIFT-CLOSE/emergency-close',
      body: { reason: 'Смена завершена по просьбе сотрудника' },
    }]);
  });

  it('keeps E11 and its reason after a close request failure', async () => {
    const fixture = SECTION03_P2A2A_FIXTURES.find((item) => item.fixtureId === 'S03-E11:request-failure')!;
    const target = await projectFixture(fixture);
    const close = actions(target.projection).find((action) =>
      action.actionId === 'CLOSE_EMPLOYEE_SHIFT');
    if (close === undefined) throw new Error('missing close action');
    const result = await target.binding.execute(close as never);
    expect(result.kind === 'business' ? result.result.status : null).toBe('error');
    expect(target.runtime.getState()).toMatchObject({
      status: 'ready',
      nodeId: 'S03-E11',
      context: {
        employee_id: 'EMP-SHIFT-CLOSE',
        shift_finish_reason: 'Смена завершена по просьбе сотрудника',
      },
    });
  });

  it('records no close-shift success metadata that returns to E02', () => {
    const close = SECTION03_BUSINESS_ACTIONS.find((item) =>
      item.actionId === 'CLOSE_EMPLOYEE_SHIFT');
    expect(close).toMatchObject({ success: 'S03-E01' });
    expect(JSON.stringify(close)).not.toContain('S03-E02');
  });

  it('pins legacy, D-167-corrected P1 and the P2A1 projection source', () => {
    const root = resolve(__dirname, '../../../../..');
    expect(sha256(resolve(root, 'frontend/miniapp/src/legacy/section03/Section03ManagerGraphHost.tsx')))
      .toBe('346e9daac7ff7528c18f3020feceeaf5094d8e9ebe5679221025096c35e1db9b');
    expect(sha256(resolve(root, 'frontend/miniapp/src/section03/projections/p1.ts')))
      .toBe('71e324f39f8a4a9a88e5348bba1e04288c7522440c423a734fc8ba3e04ab98a9');
    expect(sha256(resolve(root, 'frontend/miniapp/src/section03/projections/p2a1Employees.ts')))
      .toBe('7b10813a7139c5c0ea49e1099ee2800c845a0aa177b474e8e84c13676fe09d0f');
  });
});
