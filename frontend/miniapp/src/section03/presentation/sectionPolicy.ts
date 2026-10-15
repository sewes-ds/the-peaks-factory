import {
  STATE_PRESENTATION_SURFACES,
  definePlatformActionBinding,
  definePlatformAuthorityRole,
  definePlatformPresentationPolicy,
  definePlatformStateBinding,
  failPlatformExternalContract,
  resolvePlatformPresentation,
  supportedControlSurfaces,
  type ControlSemanticKey,
  type PlatformAuthorityKind,
  type PlatformInteraction,
  type PlatformPresentationResolution,
  type PlatformRootCapability,
  type PlatformRootOwner,
  type PlatformStyledRoot,
  type PresentationAvailability,
  type PresentationSurface,
  type StatePresentationKey,
} from '../../foundation/presentation';
import type {
  Section03NodeId,
} from '../program/ids';
import type {
  Section03Family,
  Section03LoaderKey,
  Section03ProjectionKind,
} from '../program/types';
import type { Section03BackendPresentationFamily } from '../generated/managerPresentationContract';
import { resolveSection03BackendStateBinding } from './backendTupleBinding';

export type Section03PolicySelector =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'nodes'; values: readonly Section03NodeId[] }>
  | Readonly<{ kind: 'families'; values: readonly Section03Family[] }>
  | Readonly<{ kind: 'loaders'; values: readonly Section03LoaderKey[] }>
  | Readonly<{ kind: 'projections'; values: readonly Section03ProjectionKind[] }>
  | Readonly<{ kind: 'graph-action'; value: 'back' | 'forward' | 'business' }>;

export type Section03PolicyRootDefinition = Readonly<{
  rootId: string;
  role: string | null;
  authority: PlatformAuthorityKind | 'INHERIT';
  surface: PresentationSurface;
  selector: Section03PolicySelector;
  backendFamily: Section03BackendPresentationFamily | null;
  ownership: 'independent' | 'inherit-parent';
  parentRootId?: string;
  capability?: 'independent-child-appearance';
  contextualException: string | null;
}>;

const all = Object.freeze({ kind: 'all' as const });
const nodes = (...values: Section03NodeId[]): Section03PolicySelector =>
  Object.freeze({ kind: 'nodes' as const, values: Object.freeze(values) });
const families = (...values: Section03Family[]): Section03PolicySelector =>
  Object.freeze({ kind: 'families' as const, values: Object.freeze(values) });
const loaders = (...values: Section03LoaderKey[]): Section03PolicySelector =>
  Object.freeze({ kind: 'loaders' as const, values: Object.freeze(values) });
const projections = (...values: Section03ProjectionKind[]): Section03PolicySelector =>
  Object.freeze({ kind: 'projections' as const, values: Object.freeze(values) });
const graphAction = (
  value: 'back' | 'forward' | 'business',
): Section03PolicySelector => Object.freeze({ kind: 'graph-action' as const, value });

function stateBinding(key: StatePresentationKey) {
  return definePlatformStateBinding(key);
}

function plain(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countEvidence(value: unknown): Readonly<{
  count: number;
  baseline: 'info' | 'neutral';
  positive: 'positive' | 'warning' | 'danger';
}> {
  if (
    !plain(value) ||
    Object.keys(value).some((field) => !['count', 'baseline', 'positive'].includes(field)) ||
    typeof value.count !== 'number' ||
    !Number.isSafeInteger(value.count) ||
    value.count < 0 ||
    (value.baseline !== 'info' && value.baseline !== 'neutral') ||
    (value.positive !== 'positive' && value.positive !== 'warning' && value.positive !== 'danger')
  ) {
    return failPlatformExternalContract('SECTION03_INVALID_COUNT_EVIDENCE');
  }
  return value as ReturnType<typeof countEvidence>;
}

const backendRoles = Object.freeze(([
  ['machine', 'section03-backend-machine-state'],
  ['employee', 'section03-backend-employee-state'],
  ['additional_work', 'section03-backend-additional-work-state'],
  ['notification', 'section03-backend-notification-state'],
] as const).map(([backendFamily, role]) => definePlatformAuthorityRole({
  role,
  authority: 'BACKEND_STATE',
  surfaces: STATE_PRESENTATION_SURFACES,
  resolve: (evidence) => resolveSection03BackendStateBinding(
    backendFamily,
    evidence,
  ),
})));

const staticRoles = Object.freeze(([
  ['info', 'state-info'],
  ['positive', 'state-positive'],
  ['warning', 'state-warning'],
  ['danger', 'state-danger'],
  ['neutral', 'state-neutral'],
  ['inactive', 'state-inactive'],
] as const).map(([name, key]) => definePlatformAuthorityRole({
  role: `section03-static-${name}`,
  authority: 'STATIC',
  surfaces: STATE_PRESENTATION_SURFACES,
  resolve: () => stateBinding(key),
})));

const derivedCountRole = definePlatformAuthorityRole({
  role: 'section03-derived-count-state',
  authority: 'DOMAIN_DERIVED',
  surfaces: STATE_PRESENTATION_SURFACES,
  resolve: (evidence) => {
    const current = countEvidence(evidence);
    if (current.count === 0) {
      return stateBinding(current.baseline === 'neutral' ? 'state-neutral' : 'state-info');
    }
    if (current.positive === 'danger') return stateBinding('state-danger');
    if (current.positive === 'warning') return stateBinding('state-warning');
    return stateBinding('state-positive');
  },
});

const derivedSeverityRole = definePlatformAuthorityRole({
  role: 'section03-derived-severity-state',
  authority: 'DOMAIN_DERIVED',
  surfaces: STATE_PRESENTATION_SURFACES,
  resolve: (evidence) => {
    if (!plain(evidence) || Object.keys(evidence).some((field) => !['count', 'severity'].includes(field))) {
      return failPlatformExternalContract('SECTION03_INVALID_SEVERITY_EVIDENCE');
    }
    if (typeof evidence.count !== 'number' || !Number.isSafeInteger(evidence.count) || evidence.count < 0) {
      return failPlatformExternalContract('SECTION03_INVALID_SEVERITY_EVIDENCE');
    }
    if (evidence.count === 0) return stateBinding('state-info');
    if (evidence.severity === 'critical') return stateBinding('state-danger');
    if (evidence.severity === 'operational') return stateBinding('state-warning');
    if (evidence.severity === 'none') return stateBinding('state-info');
    return failPlatformExternalContract('SECTION03_INVALID_SEVERITY_EVIDENCE');
  },
});

const derivedMainTileRole = definePlatformAuthorityRole({
  role: 'section03-derived-main-tile-state',
  authority: 'DOMAIN_DERIVED',
  surfaces: ['list-button'],
  resolve: (evidence) => {
    if (evidence === 'additional-works') return stateBinding('state-neutral');
    if (
      evidence === 'machines' || evidence === 'employees' ||
      evidence === 'downtimes' || evidence === 'corrections' ||
      evidence === 'notifications' || evidence === 'reports'
    ) {
      return stateBinding('state-info');
    }
    return failPlatformExternalContract('SECTION03_INVALID_MAIN_TILE_EVIDENCE');
  },
});

const derivedWorkTypeRole = definePlatformAuthorityRole({
  role: 'section03-derived-work-type-state',
  authority: 'DOMAIN_DERIVED',
  surfaces: ['list-button', 'card'],
  resolve: (evidence) => {
    if (evidence === 'production') return stateBinding('state-positive');
    if (evidence === 'additional_work') return stateBinding('state-info');
    return failPlatformExternalContract('SECTION03_INVALID_WORK_TYPE_EVIDENCE');
  },
});

const derivedCorrectionModeRole = definePlatformAuthorityRole({
  role: 'section03-derived-correction-mode-state',
  authority: 'DOMAIN_DERIVED',
  surfaces: ['card'],
  resolve: (evidence) => {
    if (evidence === 'accrual') return stateBinding('state-positive');
    if (evidence === 'withholding' || evidence === 'reversal') {
      return stateBinding('state-danger');
    }
    return failPlatformExternalContract('SECTION03_INVALID_CORRECTION_MODE_EVIDENCE');
  },
});

const derivedBlockerRole = definePlatformAuthorityRole({
  role: 'section03-derived-blocker-state',
  authority: 'DOMAIN_DERIVED',
  surfaces: ['list-button', 'card'],
  resolve: (evidence) => {
    if (evidence === 'production') return stateBinding('state-positive');
    if (evidence === 'break') return stateBinding('state-warning');
    if (evidence === 'additional-work') return stateBinding('state-info');
    return failPlatformExternalContract('SECTION03_INVALID_BLOCKER_EVIDENCE');
  },
});

const actionKeys = Object.freeze([
  'navigation-back',
  'navigation-next',
  'navigation-open',
  'selection-primary',
  'selection-secondary',
  'action-positive',
  'action-positive-neutral-context',
  'action-warning',
  'action-danger',
  'action-neutral',
  'action-cancel',
  'action-reject',
  'action-reversal',
] as const satisfies readonly ControlSemanticKey[]);

const actionRoles = Object.freeze(actionKeys.map((key) => {
  const supported = supportedControlSurfaces(key);
  if (supported.length === 0) {
    throw new Error(`Section 03 action role ${key} has no supported surface.`);
  }
  return definePlatformAuthorityRole({
    role: `section03-action-${key}`,
    authority: 'ACTION',
    surfaces: supported as readonly [typeof supported[number], ...typeof supported[number][]],
    resolve: () => definePlatformActionBinding(key),
  });
}));

const roles = Object.freeze([
  ...backendRoles,
  ...staticRoles,
  derivedCountRole,
  derivedSeverityRole,
  derivedMainTileRole,
  derivedWorkTypeRole,
  derivedCorrectionModeRole,
  derivedBlockerRole,
  ...actionRoles,
]);

const roleById = new Map<string, (typeof roles)[number]>(
  roles.map((role) => [role.role, role]),
);

function root(input: Omit<Section03PolicyRootDefinition, 'ownership' | 'backendFamily' | 'contextualException'> & Readonly<{
  ownership?: 'independent' | 'inherit-parent';
  backendFamily?: Section03BackendPresentationFamily | null;
  contextualException?: string | null;
}>): Section03PolicyRootDefinition {
  return Object.freeze({
    ...input,
    ownership: input.ownership ?? 'independent',
    backendFamily: input.backendFamily ?? null,
    contextualException: input.contextualException ?? null,
  });
}

export const SECTION03_POLICY_ROOTS = Object.freeze({
  backendMachineList: 'section03-root-backend-machine-list',
  backendMachineCard: 'section03-root-backend-machine-card',
  backendMachineSummary: 'section03-root-backend-machine-summary',
  backendEmployeeList: 'section03-root-backend-employee-list',
  backendEmployeeCard: 'section03-root-backend-employee-card',
  backendEmployeeSummary: 'section03-root-backend-employee-summary',
  backendAdditionalWorkList: 'section03-root-backend-additional-work-list',
  backendAdditionalWorkCard: 'section03-root-backend-additional-work-card',
  backendNotificationList: 'section03-root-backend-notification-list',
  derivedMainTile: 'section03-root-derived-main-tile',
  derivedCountSummary: 'section03-root-derived-count-summary',
  derivedSeveritySummary: 'section03-root-derived-severity-summary',
  derivedWorkTypeList: 'section03-root-derived-work-type-list',
  derivedWorkTypeCard: 'section03-root-derived-work-type-card',
  derivedCorrectionModeCard: 'section03-root-derived-correction-mode-card',
  derivedBlockerCard: 'section03-root-derived-blocker-card',
  derivedBlockerList: 'section03-root-derived-blocker-list',
  staticInfoList: 'section03-root-static-info-list',
  staticInfoCard: 'section03-root-static-info-card',
  staticInfoSummary: 'section03-root-static-info-summary',
  staticInfoMessage: 'section03-root-static-info-message',
  staticPositiveList: 'section03-root-static-positive-list',
  staticPositiveCard: 'section03-root-static-positive-card',
  staticPositiveMessage: 'section03-root-static-positive-message',
  staticWarningList: 'section03-root-static-warning-list',
  staticWarningCard: 'section03-root-static-warning-card',
  staticWarningMessage: 'section03-root-static-warning-message',
  staticDangerList: 'section03-root-static-danger-list',
  staticDangerCard: 'section03-root-static-danger-card',
  staticDangerMessage: 'section03-root-static-danger-message',
  staticNeutralList: 'section03-root-static-neutral-list',
  staticNeutralCard: 'section03-root-static-neutral-card',
  staticNeutralSummary: 'section03-root-static-neutral-summary',
  staticNeutralMessage: 'section03-root-static-neutral-message',
  staticInactiveList: 'section03-root-static-inactive-list',
  staticInactiveMessage: 'section03-root-static-inactive-message',
  action: Object.freeze(Object.fromEntries(actionKeys.flatMap((key) =>
    supportedControlSurfaces(key).map((surface) => [
      `${key}:${surface}`,
      `section03-root-action-${key}-${surface}`,
    ]),
  )) as Readonly<Record<string, string>>),
});

const catalog: Section03PolicyRootDefinition[] = [
  root({ rootId: SECTION03_POLICY_ROOTS.backendMachineList, role: 'section03-backend-machine-state', authority: 'BACKEND_STATE', surface: 'list-button', selector: loaders('machines', 'downtimes', 'machine-completed-production-operations'), backendFamily: 'machine' }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendMachineCard, role: 'section03-backend-machine-state', authority: 'BACKEND_STATE', surface: 'card', selector: loaders('machine-card'), backendFamily: 'machine' }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendMachineSummary, role: null, authority: 'INHERIT', surface: 'summary-line', selector: loaders('machines', 'downtimes'), backendFamily: 'machine', ownership: 'inherit-parent', parentRootId: SECTION03_POLICY_ROOTS.backendMachineList }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendEmployeeList, role: 'section03-backend-employee-state', authority: 'BACKEND_STATE', surface: 'list-button', selector: loaders('employees', 'salary-correction-context'), backendFamily: 'employee' }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendEmployeeCard, role: 'section03-backend-employee-state', authority: 'BACKEND_STATE', surface: 'card', selector: loaders('employee-card'), backendFamily: 'employee' }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendEmployeeSummary, role: null, authority: 'INHERIT', surface: 'summary-line', selector: loaders('employees'), backendFamily: 'employee', ownership: 'inherit-parent', parentRootId: SECTION03_POLICY_ROOTS.backendEmployeeList }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendAdditionalWorkList, role: 'section03-backend-additional-work-state', authority: 'BACKEND_STATE', surface: 'list-button', selector: loaders('additional-works'), backendFamily: 'additional_work' }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendAdditionalWorkCard, role: 'section03-backend-additional-work-state', authority: 'BACKEND_STATE', surface: 'card', selector: families('additional-works'), backendFamily: 'additional_work' }),
  root({ rootId: SECTION03_POLICY_ROOTS.backendNotificationList, role: 'section03-backend-notification-state', authority: 'BACKEND_STATE', surface: 'list-button', selector: loaders('notifications'), backendFamily: 'notification' }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedMainTile, role: 'section03-derived-main-tile-state', authority: 'DOMAIN_DERIVED', surface: 'list-button', selector: nodes('S03-N01'), contextualException: 'Additional Works is neutral; every other N01 tile is info.' }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedCountSummary, role: 'section03-derived-count-state', authority: 'DOMAIN_DERIVED', surface: 'summary-line', selector: nodes('S03-N01'), parentRootId: SECTION03_POLICY_ROOTS.derivedMainTile, capability: 'independent-child-appearance' }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedSeveritySummary, role: 'section03-derived-severity-state', authority: 'DOMAIN_DERIVED', surface: 'summary-line', selector: nodes('S03-N01'), parentRootId: SECTION03_POLICY_ROOTS.derivedMainTile, capability: 'independent-child-appearance' }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedWorkTypeList, role: 'section03-derived-work-type-state', authority: 'DOMAIN_DERIVED', surface: 'list-button', selector: families('employees', 'corrections') }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedWorkTypeCard, role: 'section03-derived-work-type-state', authority: 'DOMAIN_DERIVED', surface: 'card', selector: families('employees', 'corrections') }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedCorrectionModeCard, role: 'section03-derived-correction-mode-state', authority: 'DOMAIN_DERIVED', surface: 'card', selector: families('corrections') }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedBlockerCard, role: 'section03-derived-blocker-state', authority: 'DOMAIN_DERIVED', surface: 'card', selector: families('employees', 'additional-works') }),
  root({ rootId: SECTION03_POLICY_ROOTS.derivedBlockerList, role: 'section03-derived-blocker-state', authority: 'DOMAIN_DERIVED', surface: 'list-button', selector: families('employees', 'additional-works') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticInfoList, role: 'section03-static-info', authority: 'STATIC', surface: 'list-button', selector: projections('menu', 'list') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticInfoCard, role: 'section03-static-info', authority: 'STATIC', surface: 'card', selector: all }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticInfoSummary, role: 'section03-static-info', authority: 'STATIC', surface: 'summary-line', selector: all }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticInfoMessage, role: 'section03-static-info', authority: 'STATIC', surface: 'message', selector: all }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticPositiveList, role: 'section03-static-positive', authority: 'STATIC', surface: 'list-button', selector: families('employees', 'additional-works', 'corrections', 'reports') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticPositiveCard, role: 'section03-static-positive', authority: 'STATIC', surface: 'card', selector: projections('confirmation', 'success') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticPositiveMessage, role: 'section03-static-positive', authority: 'STATIC', surface: 'message', selector: projections('success') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticWarningList, role: 'section03-static-warning', authority: 'STATIC', surface: 'list-button', selector: families('downtimes', 'employees', 'additional-works', 'notifications') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticWarningCard, role: 'section03-static-warning', authority: 'STATIC', surface: 'card', selector: projections('confirmation') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticWarningMessage, role: 'section03-static-warning', authority: 'STATIC', surface: 'message', selector: families('downtimes', 'employees', 'additional-works') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticDangerList, role: 'section03-static-danger', authority: 'STATIC', surface: 'list-button', selector: families('downtimes', 'corrections', 'notifications') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticDangerCard, role: 'section03-static-danger', authority: 'STATIC', surface: 'card', selector: projections('confirmation') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticDangerMessage, role: 'section03-static-danger', authority: 'STATIC', surface: 'message', selector: families('downtimes', 'corrections') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticNeutralList, role: 'section03-static-neutral', authority: 'STATIC', surface: 'list-button', selector: families('additional-works', 'reports') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticNeutralCard, role: 'section03-static-neutral', authority: 'STATIC', surface: 'card', selector: families('additional-works', 'reports') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticNeutralSummary, role: 'section03-static-neutral', authority: 'STATIC', surface: 'summary-line', selector: nodes('S03-N01') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticNeutralMessage, role: 'section03-static-neutral', authority: 'STATIC', surface: 'message', selector: families('additional-works', 'reports') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticInactiveList, role: 'section03-static-inactive', authority: 'STATIC', surface: 'list-button', selector: projections('list') }),
  root({ rootId: SECTION03_POLICY_ROOTS.staticInactiveMessage, role: 'section03-static-inactive', authority: 'STATIC', surface: 'message', selector: projections('list') }),
];

for (const actionRole of actionRoles) {
  const key = actionRole.role.slice('section03-action-'.length) as ControlSemanticKey;
  for (const surface of actionRole.surfaces) {
    const selector = key === 'navigation-back'
      ? graphAction('back')
      : key === 'navigation-next'
        ? graphAction('forward')
        : key.startsWith('action-')
          ? graphAction('business')
          : all;
    catalog.push(root({
      rootId: SECTION03_POLICY_ROOTS.action[`${key}:${surface}`]!,
      role: actionRole.role,
      authority: 'ACTION',
      surface,
      selector,
    }));
  }
}

export const SECTION03_PRESENTATION_ROOT_CATALOG = Object.freeze(catalog);

const platformRoots: PlatformStyledRoot[] = catalog.map((entry) => Object.freeze({
  rootId: entry.rootId,
  surface: entry.surface,
  ownership: entry.ownership,
  ...(entry.parentRootId === undefined ? {} : { parentRootId: entry.parentRootId }),
}));
const platformOwners: PlatformRootOwner[] = catalog.flatMap((entry) =>
  entry.ownership === 'independent' && entry.role !== null
    ? [Object.freeze({ rootId: entry.rootId, role: entry.role })]
    : [],
);
const platformCapabilities: PlatformRootCapability[] = catalog.flatMap((entry) =>
  entry.capability === undefined
    ? []
    : [Object.freeze({ rootId: entry.rootId, capability: entry.capability })],
);

for (const entry of catalog) {
  if (entry.role !== null && !roleById.has(entry.role)) {
    throw new Error(`Unknown Section 03 policy role ${entry.role}.`);
  }
}

export const SECTION03_PRESENTATION_POLICY = definePlatformPresentationPolicy({
  policyId: 'section03-presentation-policy-v1',
  roles,
  roots: platformRoots,
  owners: platformOwners,
  capabilities: platformCapabilities,
});

export function resolveSection03Presentation(input: Readonly<{
  rootId: string;
  evidence: unknown;
  interaction: PlatformInteraction;
  availability: PresentationAvailability;
}>): PlatformPresentationResolution {
  return resolvePlatformPresentation({
    policy: SECTION03_PRESENTATION_POLICY,
    rootId: input.rootId,
    evidence: input.evidence,
    interaction: input.interaction,
    availability: input.availability,
  });
}
