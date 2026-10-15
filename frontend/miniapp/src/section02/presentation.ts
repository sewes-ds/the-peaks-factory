import {
  STATE_PRESENTATION_SURFACES,
  definePlatformActionBinding,
  definePlatformAuthorityRole,
  definePlatformPresentationPolicy,
  definePlatformStateBinding,
  failPlatformExternalContract,
  supportedControlSurfaces,
  type ControlSemanticKey,
  type PresentationGraphAuthorityRequest,
  type PresentationSurface,
} from '../foundation/presentation';
import type { S02ActionId } from './section02GraphActions';

const staticInfo = definePlatformAuthorityRole({
  role: 'section02-static-info', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-info'),
});
const staticPositive = definePlatformAuthorityRole({
  role: 'section02-static-positive', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-positive'),
});
const staticWarning = definePlatformAuthorityRole({
  role: 'section02-static-warning', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-warning'),
});
const staticNeutral = definePlatformAuthorityRole({
  role: 'section02-static-neutral', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-neutral'),
});
const staticInfoOutline = definePlatformAuthorityRole({
  role: 'section02-static-info-outline', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-info-outline'),
});
const staticNeutralOutline = definePlatformAuthorityRole({
  role: 'section02-static-neutral-outline', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-neutral-outline'),
});
const staticNeutralContent = definePlatformAuthorityRole({
  role: 'section02-static-neutral-content', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-neutral-content'),
});
const staticWarningField = definePlatformAuthorityRole({
  role: 'section02-static-warning-field', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-warning-field'),
});
const staticNeutralResult = definePlatformAuthorityRole({
  role: 'section02-static-neutral-result', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-neutral-result'),
});
const staticInfoTable = definePlatformAuthorityRole({
  role: 'section02-static-info-table', authority: 'STATIC', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => definePlatformStateBinding('state-info-table'),
});
const backendState = definePlatformAuthorityRole({
  role: 'section02-backend-state', authority: 'BACKEND_STATE', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: (evidence) => {
    if (evidence === 'green') return definePlatformStateBinding('state-positive');
    if (evidence === 'gray_green') return definePlatformStateBinding('state-positive-neutral-context');
    if (evidence === 'white_gray_inactive') return definePlatformStateBinding('state-inactive');
    if (evidence === 'yellow') return definePlatformStateBinding('state-warning');
    if (evidence === 'scarlet') return definePlatformStateBinding('state-danger');
    return failPlatformExternalContract('SECTION02_UNKNOWN_BACKEND_VISUAL_STATE');
  },
});
const machineState = definePlatformAuthorityRole({
  role: 'section02-machine-state', authority: 'BACKEND_STATE', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: (evidence) => {
    if (evidence === 'critical') return definePlatformStateBinding('state-danger');
    if (evidence === 'normal' || evidence === 'busy' || evidence === 'unavailable') return definePlatformStateBinding('state-info');
    return failPlatformExternalContract('SECTION02_UNKNOWN_MACHINE_VISUAL_STATE');
  },
});
const domainState = definePlatformAuthorityRole({
  role: 'section02-domain-state', authority: 'DOMAIN_DERIVED', surfaces: STATE_PRESENTATION_SURFACES,
  resolve: (evidence) => {
    if (evidence === 'active' || evidence === 'selectable' || evidence === 'clear' || evidence === 'workplace-production') return definePlatformStateBinding('state-positive');
    if (evidence === 'break' || evidence === 'warning') return definePlatformStateBinding('state-warning');
    if (evidence === 'blocked' || evidence === 'unselectable') return definePlatformStateBinding('state-danger');
    if (evidence === 'inactive' || evidence === 'pending') return definePlatformStateBinding('state-inactive');
    if (evidence === 'neutral' || evidence === 'workplace-additional') return definePlatformStateBinding('state-neutral');
    if (evidence === 'workplace-idle') return definePlatformStateBinding('state-info');
    return failPlatformExternalContract('SECTION02_UNKNOWN_DOMAIN_VISUAL_STATE');
  },
});

const actionKeys = Object.freeze([
  'navigation-back', 'navigation-next', 'navigation-open', 'selection-primary',
  'action-positive', 'action-positive-neutral-context', 'action-warning', 'action-danger', 'action-neutral',
] as const satisfies readonly ControlSemanticKey[]);

const actionRoles = Object.freeze(actionKeys.map((key) => definePlatformAuthorityRole({
  role: `section02-action-${key}`,
  authority: 'ACTION',
  surfaces: supportedControlSurfaces(key) as readonly [PresentationSurface, ...PresentationSurface[]],
  resolve: () => definePlatformActionBinding(key),
})));

export const SECTION02_POLICY_ROOTS = Object.freeze({
  staticInfoCard: 'section02-root-static-info-card',
  staticInfoList: 'section02-root-static-info-list',
  staticInfoMessage: 'section02-root-static-info-message',
  staticInfoSummary: 'section02-root-static-info-summary',
  staticPositiveCard: 'section02-root-static-positive-card',
  staticPositiveMessage: 'section02-root-static-positive-message',
  staticWarningCard: 'section02-root-static-warning-card',
  staticWarningList: 'section02-root-static-warning-list',
  staticWarningMessage: 'section02-root-static-warning-message',
  staticNeutralCard: 'section02-root-static-neutral-card',
  staticNeutralList: 'section02-root-static-neutral-list',
  staticNeutralMessage: 'section02-root-static-neutral-message',
  staticNeutralSummary: 'section02-root-static-neutral-summary',
  staticInfoOutlineCard: 'section02-root-static-info-outline-card',
  staticNeutralOutlineCard: 'section02-root-static-neutral-outline-card',
  staticNeutralContentCard: 'section02-root-static-neutral-content-card',
  staticWarningFieldCard: 'section02-root-static-warning-field-card',
  staticNeutralResultCard: 'section02-root-static-neutral-result-card',
  staticInfoTableCard: 'section02-root-static-info-table-card',
  backendList: 'section02-root-backend-list',
  backendCard: 'section02-root-backend-card',
  machineList: 'section02-root-machine-list',
  domainList: 'section02-root-domain-list',
  domainCard: 'section02-root-domain-card',
  domainMessage: 'section02-root-domain-message',
  action: Object.freeze(Object.fromEntries(actionKeys.flatMap((key) => supportedControlSurfaces(key).map((surface) => [
    `${key}:${surface}`,
    `section02-root-action-${key}-${surface}`,
  ]))) as Readonly<Record<string, string>>),
});

const stateRoots = Object.freeze([
  [SECTION02_POLICY_ROOTS.staticInfoCard, 'card', staticInfo.role],
  [SECTION02_POLICY_ROOTS.staticInfoList, 'list-button', staticInfo.role],
  [SECTION02_POLICY_ROOTS.staticInfoMessage, 'message', staticInfo.role],
  [SECTION02_POLICY_ROOTS.staticInfoSummary, 'summary-line', staticInfo.role],
  [SECTION02_POLICY_ROOTS.staticPositiveCard, 'card', staticPositive.role],
  [SECTION02_POLICY_ROOTS.staticPositiveMessage, 'message', staticPositive.role],
  [SECTION02_POLICY_ROOTS.staticWarningCard, 'card', staticWarning.role],
  [SECTION02_POLICY_ROOTS.staticWarningList, 'list-button', staticWarning.role],
  [SECTION02_POLICY_ROOTS.staticWarningMessage, 'message', staticWarning.role],
  [SECTION02_POLICY_ROOTS.staticNeutralCard, 'card', staticNeutral.role],
  [SECTION02_POLICY_ROOTS.staticNeutralList, 'list-button', staticNeutral.role],
  [SECTION02_POLICY_ROOTS.staticNeutralMessage, 'message', staticNeutral.role],
  [SECTION02_POLICY_ROOTS.staticNeutralSummary, 'summary-line', staticNeutral.role],
  [SECTION02_POLICY_ROOTS.staticInfoOutlineCard, 'card', staticInfoOutline.role],
  [SECTION02_POLICY_ROOTS.staticNeutralOutlineCard, 'card', staticNeutralOutline.role],
  [SECTION02_POLICY_ROOTS.staticNeutralContentCard, 'card', staticNeutralContent.role],
  [SECTION02_POLICY_ROOTS.staticWarningFieldCard, 'card', staticWarningField.role],
  [SECTION02_POLICY_ROOTS.staticNeutralResultCard, 'card', staticNeutralResult.role],
  [SECTION02_POLICY_ROOTS.staticInfoTableCard, 'card', staticInfoTable.role],
  [SECTION02_POLICY_ROOTS.backendList, 'list-button', backendState.role],
  [SECTION02_POLICY_ROOTS.backendCard, 'card', backendState.role],
  [SECTION02_POLICY_ROOTS.machineList, 'list-button', machineState.role],
  [SECTION02_POLICY_ROOTS.domainList, 'list-button', domainState.role],
  [SECTION02_POLICY_ROOTS.domainCard, 'card', domainState.role],
  [SECTION02_POLICY_ROOTS.domainMessage, 'message', domainState.role],
] as const);

const actionRoots = Object.freeze(actionRoles.flatMap((role) => {
  const key = role.role.slice('section02-action-'.length) as ControlSemanticKey;
  return role.surfaces.map((surface) => Object.freeze({
    rootId: SECTION02_POLICY_ROOTS.action[`${key}:${surface}`]!, surface, role: role.role,
  }));
}));

export const SECTION02_PRESENTATION_POLICY = definePlatformPresentationPolicy({
  policyId: 'section02-presentation-policy-v1',
  roles: [staticInfo, staticPositive, staticWarning, staticNeutral, staticInfoOutline, staticNeutralOutline, staticNeutralContent, staticWarningField, staticNeutralResult, staticInfoTable, backendState, machineState, domainState, ...actionRoles],
  roots: [
    ...stateRoots.map(([rootId, surface]) => Object.freeze({ rootId, surface, ownership: 'independent' as const })),
    ...actionRoots.map(({ rootId, surface }) => Object.freeze({ rootId, surface, ownership: 'independent' as const })),
  ],
  owners: [
    ...stateRoots.map(([rootId, , role]) => Object.freeze({ rootId, role })),
    ...actionRoots.map(({ rootId, role }) => Object.freeze({ rootId, role })),
  ],
});

export function section02Authority(rootId: string, evidence: unknown): PresentationGraphAuthorityRequest {
  return Object.freeze({ policy: SECTION02_PRESENTATION_POLICY, rootId, evidence });
}

export function section02ActionAuthority(key: ControlSemanticKey, surface: 'action-button' | 'list-button' = 'action-button'): PresentationGraphAuthorityRequest {
  const rootId = SECTION02_POLICY_ROOTS.action[`${key}:${surface}`];
  if (rootId === undefined) throw new Error(`Unsupported Section 02 action authority ${key}:${surface}.`);
  return section02Authority(rootId, null);
}

export const SECTION02_LEGACY_ACTION_PRESENTATION = Object.freeze({
  start_shift: 'navigation-next',
  start_production: 'navigation-next',
  finish_production: 'action-positive',
  scan_machine_qr: 'navigation-next',
  select_machine_from_list: 'navigation-open',
  select_machine: 'navigation-open',
  scan_sku_qr: 'navigation-next',
  select_sku_from_list: 'navigation-open',
  select_sku: 'navigation-open',
  start_break: 'navigation-open',
  finish_break: 'action-warning',
  start_downtime: 'navigation-open',
  finish_downtime_operational: 'action-warning',
  finish_downtime_critical: 'action-danger',
  additional_work: 'action-neutral',
  select_additional_work_type: 'action-neutral',
  request_additional_work: 'action-neutral',
  start_additional_work: 'action-positive-neutral-context',
  finish_additional_work: 'action-positive',
  finish_shift: 'action-positive',
  salary: 'navigation-back',
  back: 'navigation-back',
} as const satisfies Readonly<Record<S02ActionId, ControlSemanticKey>>);

export function section02LegacyActionAuthority(actionId: S02ActionId): PresentationGraphAuthorityRequest {
  return section02ActionAuthority(SECTION02_LEGACY_ACTION_PRESENTATION[actionId]);
}
