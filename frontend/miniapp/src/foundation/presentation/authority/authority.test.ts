import { describe, expect, it } from 'vitest';
import {
  PlatformAuthorityModelError,
  PlatformPolicyError,
  PlatformResolutionError,
  definePlatformActionBinding,
  definePlatformAuthorityRole,
  definePlatformPresentationPolicy,
  definePlatformStateBinding,
  failPlatformExternalContract,
  resolvePlatformPresentation,
  type PlatformPresentationPolicy,
} from '.';

function syntheticPolicy(): PlatformPresentationPolicy {
  const status = definePlatformAuthorityRole({
    role: 'ticket-status',
    authority: 'BACKEND_STATE',
    surfaces: ['list-button', 'summary-line'],
    resolve: (evidence) => {
      if (evidence === 'ready') return definePlatformStateBinding('state-positive');
      if (evidence === 'waiting') return definePlatformStateBinding('state-warning');
      return failPlatformExternalContract('UNKNOWN_TICKET_STATUS');
    },
  });
  const derived = definePlatformAuthorityRole({
    role: 'queue-health',
    authority: 'DOMAIN_DERIVED',
    surfaces: ['card'],
    resolve: (evidence) => definePlatformStateBinding(
      evidence === true ? 'state-positive' : 'state-danger',
    ),
  });
  const command = definePlatformAuthorityRole({
    role: 'open-ticket',
    authority: 'ACTION',
    surfaces: ['action-button'],
    resolve: () => definePlatformActionBinding('navigation-open'),
  });
  const empty = definePlatformAuthorityRole({
    role: 'empty-copy',
    authority: 'STATIC',
    surfaces: ['message'],
    resolve: () => definePlatformStateBinding('state-info'),
  });

  return definePlatformPresentationPolicy({
    policyId: 'synthetic-ticket-policy',
    roles: [status, derived, command, empty],
    roots: [
      { rootId: 'ticket-row', surface: 'list-button', ownership: 'independent' },
      { rootId: 'ticket-marker', surface: 'summary-line', ownership: 'inherit-parent', parentRootId: 'ticket-row' },
      { rootId: 'ticket-command', surface: 'action-button', ownership: 'independent', parentRootId: 'ticket-row' },
      { rootId: 'health-card', surface: 'card', ownership: 'independent' },
      { rootId: 'empty-message', surface: 'message', ownership: 'independent' },
    ],
    owners: [
      { rootId: 'ticket-row', role: 'ticket-status' },
      { rootId: 'ticket-command', role: 'open-ticket' },
      { rootId: 'health-card', role: 'queue-health' },
      { rootId: 'empty-message', role: 'empty-copy' },
    ],
    capabilities: [
      { rootId: 'ticket-command', capability: 'independent-child-appearance' },
    ],
  });
}

function resolved(input: ReturnType<typeof resolvePlatformPresentation>) {
  expect(input.status).toBe('resolved');
  if (input.status !== 'resolved') throw new Error('Expected resolved presentation.');
  return input;
}

describe('Platform Presentation Authority', () => {
  it('integrates an unrelated policy without modifying Platform Core', () => {
    const policy = syntheticPolicy();
    const state = resolved(resolvePlatformPresentation({
      policy,
      rootId: 'ticket-row',
      evidence: 'ready',
      interaction: { kind: 'action', actionId: 'OPEN_TICKET' },
      availability: 'enabled',
    }));
    const action = resolved(resolvePlatformPresentation({
      policy,
      rootId: 'ticket-command',
      evidence: null,
      interaction: { kind: 'action', actionId: 'OPEN_TICKET' },
      availability: 'enabled',
    }));

    expect(state).toMatchObject({
      authority: 'BACKEND_STATE',
      role: 'ticket-status',
      base: {
        kind: 'state',
        binding: { key: 'state-positive' },
        presentation: { surface: 'list-button', tone: 'positive' },
        recipe: { surface: 'list-button', fill: { tone: 'positive' } },
      },
    });
    expect(action).toMatchObject({
      authority: 'ACTION',
      role: 'open-ticket',
      base: {
        kind: 'action',
        binding: { key: 'navigation-open' },
        presentation: { surface: 'action-button' },
        recipe: { surface: 'action-button', intent: 'navigation' },
      },
    });
  });

  it('keeps interaction and availability separate from base appearance', () => {
    const policy = syntheticPolicy();
    const stateCases = [
      resolvePlatformPresentation({ policy, rootId: 'ticket-row', evidence: 'ready', interaction: { kind: 'inert' }, availability: 'inert' }),
      resolvePlatformPresentation({ policy, rootId: 'ticket-row', evidence: 'ready', interaction: { kind: 'action', actionId: 'OPEN_TICKET' }, availability: 'enabled' }),
      resolvePlatformPresentation({ policy, rootId: 'ticket-row', evidence: 'ready', interaction: { kind: 'action', actionId: 'OPEN_TICKET' }, availability: 'disabled' }),
      resolvePlatformPresentation({ policy, rootId: 'ticket-row', evidence: 'ready', interaction: { kind: 'action', actionId: 'OPEN_TICKET' }, availability: 'pending' }),
    ].map(resolved);

    for (const candidate of stateCases.slice(1)) {
      expect(candidate.base).toEqual(stateCases[0]?.base);
      expect(candidate.authority).toBe('BACKEND_STATE');
    }
    expect(stateCases.map((candidate) => candidate.feedback.availability))
      .toEqual(['inert', 'enabled', 'disabled', 'pending']);
  });

  it('inherits compound appearance unless an independent child has capability and owner', () => {
    const policy = syntheticPolicy();
    const inherited = resolved(resolvePlatformPresentation({
      policy,
      rootId: 'ticket-marker',
      evidence: 'waiting',
      interaction: { kind: 'inert' },
      availability: 'inert',
    }));
    expect(inherited).toMatchObject({
      rootId: 'ticket-marker',
      ownerRootId: 'ticket-row',
      role: 'ticket-status',
      base: { binding: { key: 'state-warning' }, presentation: { surface: 'summary-line' } },
    });

    const command = policy.roles.find((role) => role.role === 'open-ticket');
    const status = policy.roles.find((role) => role.role === 'ticket-status');
    expect(() => definePlatformPresentationPolicy({
      policyId: 'missing-capability',
      roles: [status!, command!],
      roots: [
        { rootId: 'parent', surface: 'list-button', ownership: 'independent' },
        { rootId: 'child', surface: 'action-button', ownership: 'independent', parentRootId: 'parent' },
      ],
      owners: [
        { rootId: 'parent', role: 'ticket-status' },
        { rootId: 'child', role: 'open-ticket' },
      ],
    })).toThrowError(new PlatformPolicyError('MISSING_COMPOUND_CAPABILITY'));
  });

  it('blocks zero, duplicate, unknown and mixed authorities structurally', () => {
    const policy = syntheticPolicy();
    expect(() => definePlatformPresentationPolicy({
      policyId: 'zero-owner',
      roles: [policy.roles[0]!],
      roots: [{ rootId: 'root', surface: 'list-button', ownership: 'independent' }],
      owners: [],
    })).toThrowError(new PlatformPolicyError('MISSING_ROOT_OWNER'));
    expect(() => definePlatformPresentationPolicy({
      policyId: 'duplicate-owner',
      roles: [policy.roles[0]!],
      roots: [{ rootId: 'root', surface: 'list-button', ownership: 'independent' }],
      owners: [
        { rootId: 'root', role: 'ticket-status' },
        { rootId: 'root', role: 'ticket-status' },
      ],
    })).toThrowError(new PlatformPolicyError('DUPLICATE_ROOT_OWNER'));
    expect(() => definePlatformPresentationPolicy({
      policyId: 'unknown-role',
      roles: [policy.roles[0]!],
      roots: [{ rootId: 'root', surface: 'list-button', ownership: 'independent' }],
      owners: [{ rootId: 'root', role: 'missing' }],
    })).toThrowError(new PlatformPolicyError('UNKNOWN_OWNER_ROLE'));

    const mixedRole = definePlatformAuthorityRole({
      role: 'mixed-role',
      authority: 'BACKEND_STATE',
      surfaces: ['list-button'],
      resolve: () => definePlatformActionBinding('navigation-open') as never,
    });
    const mixedPolicy = definePlatformPresentationPolicy({
      policyId: 'mixed-policy',
      roles: [mixedRole],
      roots: [{ rootId: 'root', surface: 'list-button', ownership: 'independent' }],
      owners: [{ rootId: 'root', role: 'mixed-role' }],
    });
    expect(() => resolvePlatformPresentation({
      policy: mixedPolicy,
      rootId: 'root',
      evidence: null,
      interaction: { kind: 'inert' },
      availability: 'inert',
    })).toThrowError(new PlatformResolutionError('AUTHORITY_BINDING_MISMATCH'));
  });

  it('rejects raw key bypass, invalid surfaces and unowned bindings', () => {
    expect(() => definePlatformStateBinding('unknown' as never))
      .toThrowError(new PlatformAuthorityModelError('INVALID_STATE_BINDING_KEY'));
    expect(() => definePlatformActionBinding('unknown' as never))
      .toThrowError(new PlatformAuthorityModelError('INVALID_ACTION_BINDING_KEY'));
    expect(() => definePlatformAuthorityRole({
      role: 'invalid-action-surface',
      authority: 'ACTION',
      surfaces: ['card'],
      resolve: () => definePlatformActionBinding('navigation-open'),
    } as never)).toThrowError(
      new PlatformAuthorityModelError('AUTHORITY_SURFACE_MISMATCH'),
    );

    const rawRole = definePlatformAuthorityRole({
      role: 'raw-role',
      authority: 'BACKEND_STATE',
      surfaces: ['message'],
      resolve: () => ({ kind: 'platform-state-binding', key: 'state-info' }) as never,
    });
    const rawPolicy = definePlatformPresentationPolicy({
      policyId: 'raw-policy',
      roles: [rawRole],
      roots: [{ rootId: 'root', surface: 'message', ownership: 'independent' }],
      owners: [{ rootId: 'root', role: 'raw-role' }],
    });
    expect(() => resolvePlatformPresentation({
      policy: rawPolicy,
      rootId: 'root',
      evidence: null,
      interaction: { kind: 'inert' },
      availability: 'inert',
    })).toThrowError(
      new PlatformResolutionError('UNOWNED_AUTHORITY_BINDING'),
    );
    expect(() => resolvePlatformPresentation({
      policy: rawPolicy,
      rootId: 'root',
      evidence: null,
      interaction: { kind: 'inert' },
      availability: 'inert',
      stateKey: 'state-info',
    } as never)).toThrowError(
      new PlatformResolutionError('UNKNOWN_RESOLUTION_REQUEST_FIELD'),
    );
  });

  it('returns a safe external failure without guessing a fallback', () => {
    const result = resolvePlatformPresentation({
      policy: syntheticPolicy(),
      rootId: 'ticket-row',
      evidence: 'unrecognized',
      interaction: { kind: 'action', actionId: 'OPEN_TICKET' },
      availability: 'enabled',
    });
    expect(result).toEqual({
      status: 'external-error',
      policyId: 'synthetic-ticket-policy',
      rootId: 'ticket-row',
      ownerRootId: 'ticket-row',
      role: 'ticket-status',
      authority: 'BACKEND_STATE',
      contractCode: 'UNKNOWN_TICKET_STATUS',
    });
    expect(result).not.toHaveProperty('base');
  });
});
