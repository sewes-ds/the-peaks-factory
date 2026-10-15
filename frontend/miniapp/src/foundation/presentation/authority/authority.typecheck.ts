import {
  definePlatformActionBinding,
  definePlatformAuthorityRole,
  definePlatformPresentationPolicy,
  definePlatformStateBinding,
  resolvePlatformPresentation,
} from '.';

const stateRole = definePlatformAuthorityRole({
  role: 'sample-state',
  authority: 'BACKEND_STATE',
  surfaces: ['card'],
  resolve: () => definePlatformStateBinding('state-info'),
});

const actionRole = definePlatformAuthorityRole({
  role: 'sample-action',
  authority: 'ACTION',
  surfaces: ['action-button'],
  resolve: () => definePlatformActionBinding('navigation-next'),
});

const policy = definePlatformPresentationPolicy({
  policyId: 'sample-policy',
  roles: [stateRole, actionRole],
  roots: [
    { rootId: 'card', surface: 'card', ownership: 'independent' },
    { rootId: 'command', surface: 'action-button', ownership: 'independent' },
  ],
  owners: [
    { rootId: 'card', role: 'sample-state' },
    { rootId: 'command', role: 'sample-action' },
  ],
});

resolvePlatformPresentation({
  policy,
  rootId: 'card',
  evidence: null,
  interaction: { kind: 'inert' },
  availability: 'inert',
});

// @ts-expect-error ACTION roles must return an action binding
definePlatformAuthorityRole({ role: 'bad-action', authority: 'ACTION', surfaces: ['action-button'], resolve: () => definePlatformStateBinding('state-info') });

// @ts-expect-error state authorities must return a state binding
definePlatformAuthorityRole({ role: 'bad-state', authority: 'STATIC', surfaces: ['message'], resolve: () => definePlatformActionBinding('navigation-open') });

resolvePlatformPresentation({
  policy,
  rootId: 'card',
  evidence: null,
  interaction: { kind: 'inert' },
  availability: 'inert',
  // @ts-expect-error raw global semantic keys cannot bypass policy resolution
  stateKey: 'state-info',
});
