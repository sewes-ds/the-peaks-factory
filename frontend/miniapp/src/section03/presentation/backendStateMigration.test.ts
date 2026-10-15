import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  PresentationGraphBridgeError,
  createPresentationGraphBridge,
  definePresentationGraphExecutionPort,
} from '../../foundation/presentation';
import {
  section03GeneratedBackendPresentationVectors,
  type Section03BackendPresentationFamily,
  type Section03BackendPresentationTuple,
} from '../generated/managerPresentationContract';
import {
  SECTION03_POLICY_ROOTS,
  SECTION03_PRESENTATION_POLICY,
  resolveSection03Presentation,
} from './sectionPolicy';

const rootsByFamily = Object.freeze({
  machine: Object.freeze([
    SECTION03_POLICY_ROOTS.backendMachineList,
    SECTION03_POLICY_ROOTS.backendMachineCard,
  ]),
  employee: Object.freeze([
    SECTION03_POLICY_ROOTS.backendEmployeeList,
    SECTION03_POLICY_ROOTS.backendEmployeeCard,
  ]),
  additional_work: Object.freeze([
    SECTION03_POLICY_ROOTS.backendAdditionalWorkList,
    SECTION03_POLICY_ROOTS.backendAdditionalWorkCard,
  ]),
  notification: Object.freeze([
    SECTION03_POLICY_ROOTS.backendNotificationList,
  ]),
} as const satisfies Readonly<Record<Section03BackendPresentationFamily, readonly string[]>>);

function productionFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return entry.isFile() && /\.ts$/.test(path) && !/\.(?:test|typecheck)\.ts$/.test(path)
      ? [path]
      : [];
  });
}

function resolved(input: ReturnType<typeof resolveSection03Presentation>) {
  expect(input.status).toBe('resolved');
  if (input.status !== 'resolved') throw new Error('Expected resolved presentation.');
  return input;
}

function resolveTuple(
  rootId: string,
  tuple: Section03BackendPresentationTuple,
  interaction: 'inert' | 'enabled' | 'disabled' | 'pending' = 'inert',
) {
  return resolved(resolveSection03Presentation({
    rootId,
    evidence: tuple,
    interaction: interaction === 'inert'
      ? { kind: 'inert' }
      : { kind: 'action', actionId: 'TEST_ACTION' },
    availability: interaction,
  }));
}

describe('S03-2 backend-state and derived-state migration', () => {
  it('passes every canonical backend vector across every approved consumer', () => {
    const vectors = section03GeneratedBackendPresentationVectors();
    expect(vectors).toHaveLength(19);
    for (const vector of vectors) {
      const cases = rootsByFamily[vector.family].map((rootId) =>
        resolveTuple(rootId, vector));
      for (const candidate of cases) {
        expect(candidate).toMatchObject({
          authority: 'BACKEND_STATE',
          base: { kind: 'state', recipe: { preserveStateToneWhenDisabled: true } },
        });
      }
      expect(new Set(cases.map((candidate) => candidate.base.binding.key)).size)
        .toBe(1);
    }
  });

  it('keeps backend-owned appearance invariant under clickability and availability', () => {
    for (const vector of section03GeneratedBackendPresentationVectors()) {
      const rootId = rootsByFamily[vector.family][0]!;
      const cases = (['inert', 'enabled', 'disabled', 'pending'] as const)
        .map((mode) => resolveTuple(rootId, vector, mode));
      for (const candidate of cases.slice(1)) {
        expect(candidate.base).toEqual(cases[0]!.base);
      }
      expect(cases.map((candidate) => candidate.feedback.availability))
        .toEqual(['inert', 'enabled', 'disabled', 'pending']);
    }
  });

  it('fails impossible tuples closed before a projection recipe exists', () => {
    const impossible = resolveSection03Presentation({
      rootId: SECTION03_POLICY_ROOTS.backendAdditionalWorkList,
      evidence: {
        family: 'additional_work',
        tuple: { status: 'waiting_accrual', ui_variant: 'yellow' },
      },
      interaction: { kind: 'inert' },
      availability: 'inert',
    });
    expect(impossible).toMatchObject({
      status: 'external-error',
      contractCode: 'UNKNOWN_BACKEND_PRESENTATION_TUPLE',
    });
    expect(impossible).not.toHaveProperty('base');
  });

  it('pins N01 neutral Additional Works, AW50 green and requested Notification gray centrally', () => {
    const n01 = resolved(resolveSection03Presentation({
      rootId: SECTION03_POLICY_ROOTS.derivedMainTile,
      evidence: 'additional-works',
      interaction: { kind: 'action', actionId: 'OPEN_ADDITIONAL_WORKS' },
      availability: 'disabled',
    }));
    expect(n01.base.binding.key).toBe('state-neutral');

    const waiting = resolveTuple(
      SECTION03_POLICY_ROOTS.backendAdditionalWorkCard,
      { family: 'additional_work', tuple: { status: 'waiting_accrual', ui_variant: 'green' } },
      'enabled',
    );
    expect(waiting.base.binding.key).toBe('state-positive');

    const notification = resolveTuple(
      SECTION03_POLICY_ROOTS.backendNotificationList,
      {
        family: 'notification',
        tuple: {
          task_kind: 'ADDITIONAL_WORK_REQUESTED',
          ui_color_token: 'gray',
          ui_variant: 'grey',
        },
      },
      'enabled',
    );
    expect(notification.base.binding.key).toBe('state-neutral');
  });

  it('resolves a policy-owned state through the generic Graph Bridge with diagnostics', () => {
    const port = definePresentationGraphExecutionPort({
      activationId: 1,
      nodeId: 'NODE',
      describe: vi.fn(() => { throw new Error('no actions'); }),
      execute: vi.fn(async () => undefined),
    });
    const bridge = createPresentationGraphBridge(port);
    const view = bridge.resolve({
      nodeId: 'NODE',
      items: [{
        kind: 'state-list-button',
        id: 'tile',
        presentationAuthority: {
          policy: SECTION03_PRESENTATION_POLICY,
          rootId: SECTION03_POLICY_ROOTS.derivedMainTile,
          evidence: 'additional-works',
        },
        interaction: { kind: 'inert' },
        mainLine: { kind: 'text', text: 'Доп. работы' },
      }],
    }, { interactionPending: false });
    expect(view.items[0]).toMatchObject({
      presentation: { key: 'state-neutral', tone: 'neutral' },
      presentationAuthority: {
        policyId: 'section03-presentation-policy-v1',
        rootId: SECTION03_POLICY_ROOTS.derivedMainTile,
        authority: 'DOMAIN_DERIVED',
      },
    });
  });

  it('contains no active projection-local backend token mapping or retired competing resolver', () => {
    const projectionRoot = resolve(process.cwd(), 'src/section03/projections');
    const forbidden = [
      /toneByColor|workState|downtimeState/,
      /resolveSection03(?:EmployeeState|MachineListState|MachineCardState|MainTileState)/,
      /from\s+['"][^'"]*stateBindings['"]/,
      /ui_color_token\s*\]/,
    ];
    for (const path of productionFiles(projectionRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const pattern of forbidden) {
        expect(source, `${relative(projectionRoot, path)} matches ${pattern}`)
          .not.toMatch(pattern);
      }
    }
  });

  it('converts a Bridge-visible impossible tuple into a closed authority error', () => {
    const port = definePresentationGraphExecutionPort({
      activationId: 1,
      nodeId: 'NODE',
      describe: vi.fn(() => { throw new Error('no actions'); }),
      execute: vi.fn(async () => undefined),
    });
    const bridge = createPresentationGraphBridge(port);
    try {
      bridge.resolve({
        nodeId: 'NODE',
        items: [{
          kind: 'card',
          id: 'invalid',
          presentationAuthority: {
            policy: SECTION03_PRESENTATION_POLICY,
            rootId: SECTION03_POLICY_ROOTS.backendAdditionalWorkCard,
            evidence: {
              family: 'additional_work',
              tuple: { status: 'waiting_accrual', ui_variant: 'yellow' },
            },
          },
          lines: [{ id: 'line', content: { kind: 'text', text: 'invalid' } }],
        }],
      }, { interactionPending: false });
      throw new Error('Expected a closed Bridge authority failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(PresentationGraphBridgeError);
      expect(error).toMatchObject({
        code: 'PRESENTATION_AUTHORITY_EXTERNAL_ERROR',
        renderId: 'invalid',
        originalError: {
          status: 'external-error',
          contractCode: 'UNKNOWN_BACKEND_PRESENTATION_TUPLE',
        },
      });
    }
  });
});
