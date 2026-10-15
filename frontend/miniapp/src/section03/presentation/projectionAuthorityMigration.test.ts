import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SECTION03_EXACT_ACTION_ROLES,
  resolveSection03ActionRole,
} from './actionPolicy';
import {
  SECTION03_POLICY_ROOTS,
  SECTION03_PRESENTATION_ROOT_CATALOG,
} from './sectionPolicy';

function graphAction(
  instanceId: string,
  options: Readonly<{
    kind?: 'business-action' | 'presentation-action';
    actionId?: string;
    event?: unknown;
  }> = {},
): object {
  return Object.freeze({
    kind: options.kind ?? 'presentation-action',
    actionId: options.actionId ?? 'navigate0',
    input: Object.freeze({ instanceId }),
    event: options.event ?? Object.freeze({}),
  });
}

describe('Section 03 S03-3 action, static and compound authority migration', () => {
  it('removes every raw state/control policy choice and implicit message default from active projections', () => {
    const directory = resolve(process.cwd(), 'src/section03/projections');
    const sources = readdirSync(directory)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(resolve(directory, name), 'utf8'))
      .join('\n');

    expect(sources).not.toMatch(/\b(?:stateKey|controlKey)\b/);
    expect(sources).not.toMatch(/'state-(?:info|positive|warning|danger|neutral|inactive)'/);
    expect(sources).not.toMatch(/\bactionRole\s*:/);
    expect(sources).not.toMatch(/rootId:\s*string\s*=/);
    expect(sources).not.toMatch(/as unknown as PresentationGraph/);
  });

  it('covers every declared action and static root through exactly one Section policy owner', () => {
    const actionRootIds = Object.values(SECTION03_POLICY_ROOTS.action);
    const staticRootIds = Object.entries(SECTION03_POLICY_ROOTS)
      .filter(([name, value]) => name.startsWith('static') && typeof value === 'string')
      .map(([, value]) => value as string);
    const definitions = new Map(
      SECTION03_PRESENTATION_ROOT_CATALOG.map((definition) => [definition.rootId, definition]),
    );

    expect(new Set(actionRootIds).size).toBe(actionRootIds.length);
    for (const rootId of actionRootIds) {
      expect(definitions.get(rootId)).toMatchObject({ authority: 'ACTION', ownership: 'independent' });
    }
    for (const rootId of staticRootIds) {
      expect(definitions.get(rootId)).toMatchObject({ authority: 'STATIC', ownership: 'independent' });
    }
  });

  it('maps Graph action evidence centrally, including contextual and dynamic cases, and fails closed', () => {
    for (const [instanceId, expectedRole] of Object.entries(SECTION03_EXACT_ACTION_ROLES)) {
      if (instanceId === 'financial-correction-create-approve') continue;
      expect(resolveSection03ActionRole(graphAction(instanceId)), instanceId).toBe(expectedRole);
    }
    expect(resolveSection03ActionRole(graphAction('financial-correction-create-approve', {
      kind: 'business-action',
      actionId: 'CREATE_APPROVE_SALARY_CORRECTION',
      event: { correction_mode: 'withholding' },
    }))).toBe('action-danger');
    expect(resolveSection03ActionRole(graphAction('financial-correction-create-approve', {
      kind: 'business-action',
      actionId: 'CREATE_APPROVE_SALARY_CORRECTION',
      event: { correction_mode: 'accrual' },
    }))).toBe('action-positive');
    expect(resolveSection03ActionRole(graphAction('machine-finish-operational-D-1'))).toBe('action-warning');
    expect(resolveSection03ActionRole(graphAction('finish-critical-D-1', {
      kind: 'business-action', actionId: 'FINISH_DOWNTIME',
    }))).toBe('action-danger');
    expect(resolveSection03ActionRole(graphAction('reports-period-week'))).toBe('selection-primary');
    expect(resolveSection03ActionRole(graphAction('any-screen-back'))).toBe('navigation-back');
    expect(() => resolveSection03ActionRole(graphAction('unregistered-action')))
      .toThrow('SECTION03_UNKNOWN_GRAPH_ACTION_ROLE');
    expect(() => resolveSection03ActionRole({ kind: 'presentation-action', actionId: 'navigate0' }))
      .toThrow('SECTION03_INVALID_GRAPH_ACTION_EVIDENCE');
  });
});
