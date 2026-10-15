import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePlatformPolicyOwner } from '../../foundation/presentation';
import {
  SECTION03_NODE_IDS,
} from '../program/ids';
import {
  SECTION03_PRESENTATION_OWNERSHIP_MATRIX,
  createSection03OwnershipMatrix,
  serializeSection03OwnershipMatrix,
} from './ownershipMatrix';
import {
  SECTION03_POLICY_ROOTS,
  SECTION03_PRESENTATION_POLICY,
  SECTION03_PRESENTATION_ROOT_CATALOG,
  resolveSection03Presentation,
} from './sectionPolicy';

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

describe('Section 03 presentation policy closure', () => {
  it('derives reproducible ownership evidence for all 70 Graph nodes', () => {
    expect(SECTION03_NODE_IDS).toHaveLength(70);
    expect(SECTION03_PRESENTATION_OWNERSHIP_MATRIX).toHaveLength(70);
    expect(SECTION03_PRESENTATION_OWNERSHIP_MATRIX.map((node) => node.nodeId))
      .toEqual(SECTION03_NODE_IDS);
    expect(createSection03OwnershipMatrix()).toEqual(SECTION03_PRESENTATION_OWNERSHIP_MATRIX);
    expect(serializeSection03OwnershipMatrix())
      .toBe(`${JSON.stringify(createSection03OwnershipMatrix(), null, 2)}\n`);
    for (const node of SECTION03_PRESENTATION_OWNERSHIP_MATRIX) {
      expect(node.roots.length, node.nodeId).toBeGreaterThan(0);
    }
  });

  it('derives every root and its single effective owner from the unified policy', () => {
    expect(SECTION03_PRESENTATION_POLICY.roots.map((root) => root.rootId))
      .toEqual(SECTION03_PRESENTATION_ROOT_CATALOG.map((root) => root.rootId));
    expect(new Set(SECTION03_PRESENTATION_POLICY.roots.map((root) => root.rootId)).size)
      .toBe(SECTION03_PRESENTATION_POLICY.roots.length);

    const coveredRoots = new Set(
      SECTION03_PRESENTATION_OWNERSHIP_MATRIX.flatMap((node) =>
        node.roots.map((root) => root.rootId)),
    );
    expect(coveredRoots).toEqual(new Set(
      SECTION03_PRESENTATION_ROOT_CATALOG.map((root) => root.rootId),
    ));
    for (const root of SECTION03_PRESENTATION_ROOT_CATALOG) {
      const owner = resolvePlatformPolicyOwner(SECTION03_PRESENTATION_POLICY, root.rootId);
      expect(owner.owner.rootId).toBe(owner.ownerRoot.rootId);
      expect(owner.role.role).toBe(owner.owner.role);
      expect(owner.role.role).not.toMatch(/fallback/i);
    }
  });

  it('records backend families, compound inheritance, capabilities and contextual exceptions', () => {
    const root = (rootId: string) => SECTION03_PRESENTATION_ROOT_CATALOG.find(
      (candidate) => candidate.rootId === rootId,
    );
    expect(root(SECTION03_POLICY_ROOTS.backendMachineList)).toMatchObject({
      authority: 'BACKEND_STATE', backendFamily: 'machine', ownership: 'independent',
    });
    expect(root(SECTION03_POLICY_ROOTS.backendEmployeeList)).toMatchObject({
      authority: 'BACKEND_STATE', backendFamily: 'employee', ownership: 'independent',
    });
    expect(root(SECTION03_POLICY_ROOTS.backendAdditionalWorkList)).toMatchObject({
      authority: 'BACKEND_STATE', backendFamily: 'additional_work', ownership: 'independent',
    });
    expect(root(SECTION03_POLICY_ROOTS.backendNotificationList)).toMatchObject({
      authority: 'BACKEND_STATE', backendFamily: 'notification', ownership: 'independent',
    });
    expect(root(SECTION03_POLICY_ROOTS.backendMachineSummary)).toMatchObject({
      authority: 'INHERIT', ownership: 'inherit-parent',
      parentRootId: SECTION03_POLICY_ROOTS.backendMachineList,
    });
    expect(root(SECTION03_POLICY_ROOTS.derivedCountSummary)).toMatchObject({
      ownership: 'independent', parentRootId: SECTION03_POLICY_ROOTS.derivedMainTile,
      capability: 'independent-child-appearance',
    });
    expect(root(SECTION03_POLICY_ROOTS.derivedMainTile)?.contextualException)
      .toMatch(/Additional Works is neutral/);
  });

  it('pins Owner contextual states independently of interaction and availability', () => {
    const awCases = [
      resolveSection03Presentation({ rootId: SECTION03_POLICY_ROOTS.derivedMainTile, evidence: 'additional-works', interaction: { kind: 'inert' }, availability: 'inert' }),
      resolveSection03Presentation({ rootId: SECTION03_POLICY_ROOTS.derivedMainTile, evidence: 'additional-works', interaction: { kind: 'action', actionId: 'OPEN_ADDITIONAL_WORKS' }, availability: 'enabled' }),
      resolveSection03Presentation({ rootId: SECTION03_POLICY_ROOTS.derivedMainTile, evidence: 'additional-works', interaction: { kind: 'action', actionId: 'OPEN_ADDITIONAL_WORKS' }, availability: 'disabled' }),
      resolveSection03Presentation({ rootId: SECTION03_POLICY_ROOTS.derivedMainTile, evidence: 'additional-works', interaction: { kind: 'action', actionId: 'OPEN_ADDITIONAL_WORKS' }, availability: 'pending' }),
    ].map(resolved);
    expect(awCases.map((result) => result.base.binding.key))
      .toEqual(['state-neutral', 'state-neutral', 'state-neutral', 'state-neutral']);

    const waiting = resolved(resolveSection03Presentation({
      rootId: SECTION03_POLICY_ROOTS.backendAdditionalWorkList,
      evidence: { family: 'additional_work', tuple: { status: 'waiting_accrual', ui_variant: 'green' } },
      interaction: { kind: 'inert' },
      availability: 'inert',
    }));
    expect(waiting.base).toMatchObject({ binding: { key: 'state-positive' } });
  });

  it('keeps Section vocabulary out of Platform Core and adds no global semantic key', () => {
    const authorityRoot = resolve(process.cwd(), 'src/foundation/presentation/authority');
    for (const path of productionFiles(authorityRoot)) {
      const source = readFileSync(path, 'utf8');
      expect(source, relative(authorityRoot, path)).not.toMatch(
        /machine|employee|additional.?work|downtime|notification|salary|report|S03-/i,
      );
    }
    const stateSource = readFileSync(
      resolve(process.cwd(), 'src/foundation/presentation/states/model.ts'),
      'utf8',
    );
    const controlSource = readFileSync(
      resolve(process.cwd(), 'src/foundation/presentation/controls/keys.ts'),
      'utf8',
    );
    expect(stateSource).not.toMatch(/section03|S03-/i);
    expect(controlSource).not.toMatch(/section03|S03-/i);
  });
});
