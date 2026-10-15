import {
  PRESENTATION_SURFACES,
  type PresentationSurface,
} from '../model';
import {
  PLATFORM_COMPOUND_CAPABILITIES,
  isPlatformAuthorityRoleOwned,
  type PlatformAuthorityRole,
  type PlatformCompoundCapability,
} from './model';

export type PlatformStyledRoot = Readonly<{
  rootId: string;
  surface: PresentationSurface;
  ownership: 'independent' | 'inherit-parent';
  parentRootId?: string;
}>;

export type PlatformRootOwner = Readonly<{
  rootId: string;
  role: string;
}>;

export type PlatformRootCapability = Readonly<{
  rootId: string;
  capability: PlatformCompoundCapability;
}>;

declare const platformPresentationPolicyBrand: unique symbol;

export type PlatformPresentationPolicy = Readonly<{
  kind: 'platform-presentation-policy';
  policyId: string;
  roles: readonly PlatformAuthorityRole[];
  roots: readonly PlatformStyledRoot[];
  owners: readonly PlatformRootOwner[];
  capabilities: readonly PlatformRootCapability[];
  readonly [platformPresentationPolicyBrand]: true;
}>;

export type PlatformResolvedPolicyOwner = Readonly<{
  requestedRoot: PlatformStyledRoot;
  ownerRoot: PlatformStyledRoot;
  owner: PlatformRootOwner;
  role: PlatformAuthorityRole;
}>;

export const PLATFORM_POLICY_ERROR_CODES = Object.freeze([
  'INVALID_POLICY',
  'UNKNOWN_POLICY_FIELD',
  'INVALID_POLICY_ID',
  'INVALID_POLICY_ROLES',
  'DUPLICATE_POLICY_ROLE',
  'INVALID_STYLED_ROOT',
  'UNKNOWN_STYLED_ROOT_FIELD',
  'DUPLICATE_STYLED_ROOT',
  'INVALID_ROOT_SURFACE',
  'INVALID_ROOT_OWNERSHIP',
  'INVALID_ROOT_PARENT',
  'COMPOUND_ROOT_CYCLE',
  'INVALID_ROOT_OWNER',
  'UNKNOWN_ROOT_OWNER_FIELD',
  'DUPLICATE_ROOT_OWNER',
  'UNKNOWN_OWNER_ROOT',
  'UNKNOWN_OWNER_ROLE',
  'MISSING_ROOT_OWNER',
  'INHERITED_ROOT_HAS_OWNER',
  'INVALID_ROOT_CAPABILITY',
  'UNKNOWN_ROOT_CAPABILITY_FIELD',
  'DUPLICATE_ROOT_CAPABILITY',
  'UNKNOWN_CAPABILITY_ROOT',
  'MISSING_COMPOUND_CAPABILITY',
  'UNEXPECTED_COMPOUND_CAPABILITY',
  'ROLE_SURFACE_MISMATCH',
  'POLICY_NOT_OWNED',
  'UNKNOWN_RESOLUTION_ROOT',
] as const);

export type PlatformPolicyErrorCode =
  typeof PLATFORM_POLICY_ERROR_CODES[number];

export class PlatformPolicyError extends Error {
  readonly code: PlatformPolicyErrorCode;

  constructor(code: PlatformPolicyErrorCode) {
    super(code);
    this.name = 'PlatformPolicyError';
    this.code = code;
    Object.freeze(this);
  }
}

const ownedPolicies = new WeakSet<object>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknownFields(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  code: PlatformPolicyErrorCode,
): void {
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) {
      throw new PlatformPolicyError(code);
    }
  }
}

function identity(value: unknown, code: PlatformPolicyErrorCode): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PlatformPolicyError(code);
  }
  return value.trim();
}

function styledRoot(value: unknown): PlatformStyledRoot {
  if (!isPlainObject(value)) {
    throw new PlatformPolicyError('INVALID_STYLED_ROOT');
  }
  rejectUnknownFields(
    value,
    ['rootId', 'surface', 'ownership', 'parentRootId'],
    'UNKNOWN_STYLED_ROOT_FIELD',
  );
  const rootId = identity(value.rootId, 'INVALID_STYLED_ROOT');
  if (
    typeof value.surface !== 'string' ||
    !PRESENTATION_SURFACES.includes(
      value.surface as PresentationSurface,
    )
  ) {
    throw new PlatformPolicyError('INVALID_ROOT_SURFACE');
  }
  if (
    value.ownership !== 'independent' &&
    value.ownership !== 'inherit-parent'
  ) {
    throw new PlatformPolicyError('INVALID_ROOT_OWNERSHIP');
  }
  const parentRootId = value.parentRootId === undefined
    ? undefined
    : identity(value.parentRootId, 'INVALID_ROOT_PARENT');
  if (
    value.ownership === 'inherit-parent' &&
    parentRootId === undefined
  ) {
    throw new PlatformPolicyError('INVALID_ROOT_PARENT');
  }
  if (parentRootId === rootId) {
    throw new PlatformPolicyError('COMPOUND_ROOT_CYCLE');
  }
  return Object.freeze({
    rootId,
    surface: value.surface as PresentationSurface,
    ownership: value.ownership,
    ...(parentRootId === undefined ? {} : { parentRootId }),
  });
}

function rootOwner(value: unknown): PlatformRootOwner {
  if (!isPlainObject(value)) {
    throw new PlatformPolicyError('INVALID_ROOT_OWNER');
  }
  rejectUnknownFields(
    value,
    ['rootId', 'role'],
    'UNKNOWN_ROOT_OWNER_FIELD',
  );
  return Object.freeze({
    rootId: identity(value.rootId, 'INVALID_ROOT_OWNER'),
    role: identity(value.role, 'INVALID_ROOT_OWNER'),
  });
}

function rootCapability(value: unknown): PlatformRootCapability {
  if (!isPlainObject(value)) {
    throw new PlatformPolicyError('INVALID_ROOT_CAPABILITY');
  }
  rejectUnknownFields(
    value,
    ['rootId', 'capability'],
    'UNKNOWN_ROOT_CAPABILITY_FIELD',
  );
  if (
    typeof value.capability !== 'string' ||
    !PLATFORM_COMPOUND_CAPABILITIES.includes(
      value.capability as PlatformCompoundCapability,
    )
  ) {
    throw new PlatformPolicyError('INVALID_ROOT_CAPABILITY');
  }
  return Object.freeze({
    rootId: identity(value.rootId, 'INVALID_ROOT_CAPABILITY'),
    capability: value.capability as PlatformCompoundCapability,
  });
}

function assertNoParentCycle(
  root: PlatformStyledRoot,
  roots: ReadonlyMap<string, PlatformStyledRoot>,
): void {
  const visited = new Set<string>([root.rootId]);
  let current = root;
  while (current.parentRootId !== undefined) {
    if (visited.has(current.parentRootId)) {
      throw new PlatformPolicyError('COMPOUND_ROOT_CYCLE');
    }
    visited.add(current.parentRootId);
    const parent = roots.get(current.parentRootId);
    if (parent === undefined) {
      throw new PlatformPolicyError('INVALID_ROOT_PARENT');
    }
    current = parent;
  }
}

function resolvedOwnerRoot(
  root: PlatformStyledRoot,
  roots: ReadonlyMap<string, PlatformStyledRoot>,
): PlatformStyledRoot {
  let current = root;
  while (current.ownership === 'inherit-parent') {
    const parent = current.parentRootId === undefined
      ? undefined
      : roots.get(current.parentRootId);
    if (parent === undefined) {
      throw new PlatformPolicyError('INVALID_ROOT_PARENT');
    }
    current = parent;
  }
  return current;
}

export function definePlatformPresentationPolicy(input: Readonly<{
  policyId: string;
  roles: readonly PlatformAuthorityRole[];
  roots: readonly PlatformStyledRoot[];
  owners: readonly PlatformRootOwner[];
  capabilities?: readonly PlatformRootCapability[];
}>): PlatformPresentationPolicy {
  if (!isPlainObject(input)) {
    throw new PlatformPolicyError('INVALID_POLICY');
  }
  rejectUnknownFields(
    input,
    ['policyId', 'roles', 'roots', 'owners', 'capabilities'],
    'UNKNOWN_POLICY_FIELD',
  );
  const policyId = identity(input.policyId, 'INVALID_POLICY_ID');
  if (!Array.isArray(input.roles) || input.roles.length === 0) {
    throw new PlatformPolicyError('INVALID_POLICY_ROLES');
  }
  if (!Array.isArray(input.roots) || input.roots.length === 0) {
    throw new PlatformPolicyError('INVALID_STYLED_ROOT');
  }
  if (!Array.isArray(input.owners)) {
    throw new PlatformPolicyError('INVALID_ROOT_OWNER');
  }
  if (input.capabilities !== undefined && !Array.isArray(input.capabilities)) {
    throw new PlatformPolicyError('INVALID_ROOT_CAPABILITY');
  }

  const roles = input.roles.map((role) => {
    if (!isPlatformAuthorityRoleOwned(role)) {
      throw new PlatformPolicyError('INVALID_POLICY_ROLES');
    }
    return role;
  });
  const roleById = new Map<string, PlatformAuthorityRole>();
  for (const role of roles) {
    if (roleById.has(role.role)) {
      throw new PlatformPolicyError('DUPLICATE_POLICY_ROLE');
    }
    roleById.set(role.role, role);
  }

  const roots = input.roots.map(styledRoot);
  const rootById = new Map<string, PlatformStyledRoot>();
  for (const root of roots) {
    if (rootById.has(root.rootId)) {
      throw new PlatformPolicyError('DUPLICATE_STYLED_ROOT');
    }
    rootById.set(root.rootId, root);
  }
  for (const root of roots) {
    assertNoParentCycle(root, rootById);
  }

  const owners = input.owners.map(rootOwner);
  const ownerByRootId = new Map<string, PlatformRootOwner>();
  for (const owner of owners) {
    if (ownerByRootId.has(owner.rootId)) {
      throw new PlatformPolicyError('DUPLICATE_ROOT_OWNER');
    }
    if (!rootById.has(owner.rootId)) {
      throw new PlatformPolicyError('UNKNOWN_OWNER_ROOT');
    }
    if (!roleById.has(owner.role)) {
      throw new PlatformPolicyError('UNKNOWN_OWNER_ROLE');
    }
    ownerByRootId.set(owner.rootId, owner);
  }

  const capabilities = (input.capabilities ?? []).map(rootCapability);
  const capabilityByRootId = new Map<string, PlatformRootCapability>();
  for (const capability of capabilities) {
    if (capabilityByRootId.has(capability.rootId)) {
      throw new PlatformPolicyError('DUPLICATE_ROOT_CAPABILITY');
    }
    if (!rootById.has(capability.rootId)) {
      throw new PlatformPolicyError('UNKNOWN_CAPABILITY_ROOT');
    }
    capabilityByRootId.set(capability.rootId, capability);
  }

  for (const root of roots) {
    const owner = ownerByRootId.get(root.rootId);
    const capability = capabilityByRootId.get(root.rootId);
    if (root.ownership === 'inherit-parent') {
      if (owner !== undefined) {
        throw new PlatformPolicyError('INHERITED_ROOT_HAS_OWNER');
      }
      if (capability !== undefined) {
        throw new PlatformPolicyError(
          'UNEXPECTED_COMPOUND_CAPABILITY',
        );
      }
    } else {
      if (owner === undefined) {
        throw new PlatformPolicyError('MISSING_ROOT_OWNER');
      }
      if (
        root.parentRootId !== undefined &&
        capability === undefined
      ) {
        throw new PlatformPolicyError(
          'MISSING_COMPOUND_CAPABILITY',
        );
      }
      if (
        root.parentRootId === undefined &&
        capability !== undefined
      ) {
        throw new PlatformPolicyError(
          'UNEXPECTED_COMPOUND_CAPABILITY',
        );
      }
    }

    const ownerRoot = resolvedOwnerRoot(root, rootById);
    const resolvedOwner = ownerByRootId.get(ownerRoot.rootId);
    if (resolvedOwner === undefined) {
      throw new PlatformPolicyError('MISSING_ROOT_OWNER');
    }
    const role = roleById.get(resolvedOwner.role);
    if (role === undefined || !role.surfaces.includes(root.surface)) {
      throw new PlatformPolicyError('ROLE_SURFACE_MISMATCH');
    }
  }

  const policy = Object.freeze({
    kind: 'platform-presentation-policy' as const,
    policyId,
    roles: Object.freeze([...roles]),
    roots: Object.freeze([...roots]),
    owners: Object.freeze([...owners]),
    capabilities: Object.freeze([...capabilities]),
  }) as PlatformPresentationPolicy;
  ownedPolicies.add(policy);
  return policy;
}

export function isPlatformPresentationPolicyOwned(
  value: unknown,
): value is PlatformPresentationPolicy {
  return (
    typeof value === 'object' &&
    value !== null &&
    ownedPolicies.has(value)
  );
}

export function resolvePlatformPolicyOwner(
  policy: PlatformPresentationPolicy,
  rootId: string,
): PlatformResolvedPolicyOwner {
  if (!isPlatformPresentationPolicyOwned(policy)) {
    throw new PlatformPolicyError('POLICY_NOT_OWNED');
  }
  const requestedRoot = policy.roots.find((root) => root.rootId === rootId);
  if (requestedRoot === undefined) {
    throw new PlatformPolicyError('UNKNOWN_RESOLUTION_ROOT');
  }
  const rootById = new Map(policy.roots.map((root) => [root.rootId, root]));
  const ownerRoot = resolvedOwnerRoot(requestedRoot, rootById);
  const owner = policy.owners.find(
    (candidate) => candidate.rootId === ownerRoot.rootId,
  );
  const role = owner === undefined
    ? undefined
    : policy.roles.find((candidate) => candidate.role === owner.role);
  if (owner === undefined || role === undefined) {
    throw new PlatformPolicyError('MISSING_ROOT_OWNER');
  }
  return Object.freeze({ requestedRoot, ownerRoot, owner, role });
}
