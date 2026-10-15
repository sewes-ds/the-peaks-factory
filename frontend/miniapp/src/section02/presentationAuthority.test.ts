import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePlatformPresentation } from '../foundation/presentation';
import { S02_ACTION_REGISTRY, type S02ActionId } from './section02GraphActions';
import {
  SECTION02_LEGACY_ACTION_PRESENTATION,
  SECTION02_POLICY_ROOTS,
  SECTION02_PRESENTATION_POLICY,
} from './presentation';

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  });
}

describe('Section 02 Presentation Authority', () => {
  it('owns backend, domain, action and static roots independently', () => {
    const authorities = new Set(SECTION02_PRESENTATION_POLICY.owners.map((owner) => {
      const role = SECTION02_PRESENTATION_POLICY.roles.find((candidate) => candidate.role === owner.role);
      return role?.authority;
    }));
    expect(authorities).toEqual(new Set(['BACKEND_STATE', 'DOMAIN_DERIVED', 'ACTION', 'STATIC']));
    expect(SECTION02_PRESENTATION_POLICY.roots.every((root) => root.ownership === 'independent')).toBe(true);
  });

  it('keeps backend visual authority independent from interaction availability', () => {
    const enabled = resolvePlatformPresentation({ policy: SECTION02_PRESENTATION_POLICY, rootId: SECTION02_POLICY_ROOTS.backendList, evidence: 'green', interaction: { kind: 'action', actionId: 'open' }, availability: 'enabled' });
    const inert = resolvePlatformPresentation({ policy: SECTION02_PRESENTATION_POLICY, rootId: SECTION02_POLICY_ROOTS.backendList, evidence: 'green', interaction: { kind: 'inert' }, availability: 'disabled' });
    expect(enabled.status).toBe('resolved');
    expect(inert.status).toBe('resolved');
    if (enabled.status === 'resolved' && inert.status === 'resolved') {
      expect(enabled.base).toEqual(inert.base);
      expect(enabled.authority).toBe('BACKEND_STATE');
    }
  });

  it.each([
    ['normal', 'state-info'],
    ['busy', 'state-info'],
    ['critical', 'state-danger'],
    ['unavailable', 'state-info'],
  ] as const)('maps machine status %s through backend visual authority to %s', (evidence, expectedState) => {
    const result = resolvePlatformPresentation({
      policy: SECTION02_PRESENTATION_POLICY,
      rootId: SECTION02_POLICY_ROOTS.machineList,
      evidence,
      interaction: { kind: 'inert' },
      availability: 'disabled',
    });
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.authority).toBe('BACKEND_STATE');
      expect(result.base).toMatchObject({ kind: 'state', binding: { key: expectedState } });
    }
  });

  it('translates every typed legacy S02 action variant without changing platform tokens', () => {
    const semanticByLegacyVariant = {
      primaryBlue: new Set(['navigation-next']),
      lightBlue: new Set(['navigation-open']),
      outlineBlue: new Set(['navigation-back']),
      green: new Set(['action-positive']),
      yellow: new Set(['action-warning']),
      gray: new Set(['action-neutral', 'action-positive-neutral-context']),
      red: new Set(['action-danger']),
    } as const;
    expect(Object.keys(SECTION02_LEGACY_ACTION_PRESENTATION)).toEqual(Object.keys(S02_ACTION_REGISTRY));
    for (const [actionId, definition] of Object.entries(S02_ACTION_REGISTRY)) {
      expect(
        semanticByLegacyVariant[definition.variant].has(
          SECTION02_LEGACY_ACTION_PRESENTATION[actionId as S02ActionId] as never,
        ),
        actionId,
      ).toBe(true);
    }
  });

  it('contains no physical color ownership in Section 02 application TypeScript or layout CSS', () => {
    const root = resolve(process.cwd(), 'src/section02');
    const applicationFiles = files(root).filter((path) => !path.includes('__fixtures__') && !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'));
    for (const path of applicationFiles) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\s*\(/i);
    }
    const css = readFileSync(join(root, 'section02.css'), 'utf8');
    expect(css).not.toMatch(/\b(?:color|background|border|box-shadow|opacity|filter)\s*:/i);
  });
});
