import {
  CONTROL_SEMANTIC_KEYS,
  CONTROL_SURFACES,
  type ControlSemanticKey,
  type ControlSurface,
} from '../controls';
import type { PresentationSurface } from '../model';
import {
  STATE_PRESENTATION_KEYS,
  STATE_PRESENTATION_SURFACES,
  type StatePresentationKey,
  type StatePresentationSurface,
} from '../states';

export const PLATFORM_AUTHORITY_KINDS = Object.freeze([
  'BACKEND_STATE',
  'DOMAIN_DERIVED',
  'ACTION',
  'STATIC',
] as const);

export type PlatformAuthorityKind =
  typeof PLATFORM_AUTHORITY_KINDS[number];

export const PLATFORM_COMPOUND_CAPABILITIES = Object.freeze([
  'independent-child-appearance',
] as const);

export type PlatformCompoundCapability =
  typeof PLATFORM_COMPOUND_CAPABILITIES[number];

export type PlatformInteraction =
  | Readonly<{ kind: 'action'; actionId: string }>
  | Readonly<{ kind: 'inert' }>;

declare const platformStateBindingBrand: unique symbol;
declare const platformActionBindingBrand: unique symbol;
declare const platformAuthorityRoleBrand: unique symbol;

export type PlatformStateBinding = Readonly<{
  kind: 'platform-state-binding';
  key: StatePresentationKey;
  readonly [platformStateBindingBrand]: true;
}>;

export type PlatformActionBinding = Readonly<{
  kind: 'platform-action-binding';
  key: ControlSemanticKey;
  readonly [platformActionBindingBrand]: true;
}>;

export type PlatformAppearanceBinding =
  | PlatformStateBinding
  | PlatformActionBinding;

type PlatformBindingFor<TAuthority extends PlatformAuthorityKind> =
  TAuthority extends 'ACTION'
    ? PlatformActionBinding
    : PlatformStateBinding;

export type PlatformAuthorityRole<
  TRole extends string = string,
  TAuthority extends PlatformAuthorityKind = PlatformAuthorityKind,
> = Readonly<{
  kind: 'platform-authority-role';
  role: TRole;
  authority: TAuthority;
  surfaces: readonly PresentationSurface[];
  resolve: (evidence: unknown) => PlatformBindingFor<TAuthority>;
  readonly [platformAuthorityRoleBrand]: true;
}>;

export const PLATFORM_AUTHORITY_MODEL_ERROR_CODES = Object.freeze([
  'INVALID_STATE_BINDING_KEY',
  'INVALID_ACTION_BINDING_KEY',
  'INVALID_AUTHORITY_ROLE',
  'UNKNOWN_AUTHORITY_ROLE_FIELD',
  'INVALID_AUTHORITY_ROLE_ID',
  'INVALID_AUTHORITY_KIND',
  'INVALID_AUTHORITY_SURFACES',
  'DUPLICATE_AUTHORITY_SURFACE',
  'AUTHORITY_SURFACE_MISMATCH',
  'INVALID_AUTHORITY_RESOLVER',
  'INVALID_EXTERNAL_CONTRACT_CODE',
] as const);

export type PlatformAuthorityModelErrorCode =
  typeof PLATFORM_AUTHORITY_MODEL_ERROR_CODES[number];

export class PlatformAuthorityModelError extends Error {
  readonly code: PlatformAuthorityModelErrorCode;

  constructor(code: PlatformAuthorityModelErrorCode) {
    super(code);
    this.name = 'PlatformAuthorityModelError';
    this.code = code;
    Object.freeze(this);
  }
}

export class PlatformExternalContractError extends Error {
  readonly contractCode: string;

  constructor(contractCode: string) {
    super('PLATFORM_EXTERNAL_CONTRACT_ERROR');
    this.name = 'PlatformExternalContractError';
    this.contractCode = contractCode;
    Object.freeze(this);
  }
}

const ownedStateBindings = new WeakSet<object>();
const ownedActionBindings = new WeakSet<object>();
const ownedAuthorityRoles = new WeakSet<object>();

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
): void {
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) {
      throw new PlatformAuthorityModelError(
        'UNKNOWN_AUTHORITY_ROLE_FIELD',
      );
    }
  }
}

function isAuthorityKind(value: unknown): value is PlatformAuthorityKind {
  return (
    typeof value === 'string' &&
    PLATFORM_AUTHORITY_KINDS.includes(value as PlatformAuthorityKind)
  );
}

function isStateSurface(
  value: PresentationSurface,
): value is StatePresentationSurface {
  return STATE_PRESENTATION_SURFACES.includes(
    value as StatePresentationSurface,
  );
}

function isControlSurface(
  value: PresentationSurface,
): value is ControlSurface {
  return CONTROL_SURFACES.includes(value as ControlSurface);
}

export function definePlatformStateBinding(
  key: StatePresentationKey,
): PlatformStateBinding {
  if (!STATE_PRESENTATION_KEYS.includes(key)) {
    throw new PlatformAuthorityModelError('INVALID_STATE_BINDING_KEY');
  }
  const binding = Object.freeze({
    kind: 'platform-state-binding' as const,
    key,
  }) as PlatformStateBinding;
  ownedStateBindings.add(binding);
  return binding;
}

export function definePlatformActionBinding(
  key: ControlSemanticKey,
): PlatformActionBinding {
  if (!CONTROL_SEMANTIC_KEYS.includes(key)) {
    throw new PlatformAuthorityModelError('INVALID_ACTION_BINDING_KEY');
  }
  const binding = Object.freeze({
    kind: 'platform-action-binding' as const,
    key,
  }) as PlatformActionBinding;
  ownedActionBindings.add(binding);
  return binding;
}

export function isPlatformStateBindingOwned(
  value: unknown,
): value is PlatformStateBinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    ownedStateBindings.has(value)
  );
}

export function isPlatformActionBindingOwned(
  value: unknown,
): value is PlatformActionBinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    ownedActionBindings.has(value)
  );
}

export function definePlatformAuthorityRole<
  const TRole extends string,
  const TAuthority extends PlatformAuthorityKind,
>(
  input: Readonly<{
    role: TRole;
    authority: TAuthority;
    surfaces: readonly [PresentationSurface, ...PresentationSurface[]];
    resolve: (evidence: unknown) => PlatformBindingFor<TAuthority>;
  }>,
): PlatformAuthorityRole<TRole, TAuthority> {
  if (!isPlainObject(input)) {
    throw new PlatformAuthorityModelError('INVALID_AUTHORITY_ROLE');
  }
  rejectUnknownFields(input, [
    'role',
    'authority',
    'surfaces',
    'resolve',
  ]);
  if (typeof input.role !== 'string' || input.role.trim().length === 0) {
    throw new PlatformAuthorityModelError('INVALID_AUTHORITY_ROLE_ID');
  }
  if (!isAuthorityKind(input.authority)) {
    throw new PlatformAuthorityModelError('INVALID_AUTHORITY_KIND');
  }
  if (!Array.isArray(input.surfaces) || input.surfaces.length === 0) {
    throw new PlatformAuthorityModelError('INVALID_AUTHORITY_SURFACES');
  }
  const uniqueSurfaces = new Set<PresentationSurface>();
  for (const surface of input.surfaces) {
    if (
      !STATE_PRESENTATION_SURFACES.includes(
        surface as StatePresentationSurface,
      ) &&
      !CONTROL_SURFACES.includes(surface as ControlSurface)
    ) {
      throw new PlatformAuthorityModelError('INVALID_AUTHORITY_SURFACES');
    }
    if (uniqueSurfaces.has(surface)) {
      throw new PlatformAuthorityModelError(
        'DUPLICATE_AUTHORITY_SURFACE',
      );
    }
    uniqueSurfaces.add(surface);
    if (
      (input.authority === 'ACTION' && !isControlSurface(surface)) ||
      (input.authority !== 'ACTION' && !isStateSurface(surface))
    ) {
      throw new PlatformAuthorityModelError(
        'AUTHORITY_SURFACE_MISMATCH',
      );
    }
  }
  if (typeof input.resolve !== 'function') {
    throw new PlatformAuthorityModelError('INVALID_AUTHORITY_RESOLVER');
  }

  const role = Object.freeze({
    kind: 'platform-authority-role' as const,
    role: input.role.trim() as TRole,
    authority: input.authority,
    surfaces: Object.freeze([...input.surfaces]),
    resolve: input.resolve,
  }) as PlatformAuthorityRole<TRole, TAuthority>;
  ownedAuthorityRoles.add(role);
  return role;
}

export function isPlatformAuthorityRoleOwned(
  value: unknown,
): value is PlatformAuthorityRole {
  return (
    typeof value === 'object' &&
    value !== null &&
    ownedAuthorityRoles.has(value)
  );
}

export function failPlatformExternalContract(
  contractCode: string,
): never {
  if (contractCode.trim().length === 0) {
    throw new PlatformAuthorityModelError(
      'INVALID_EXTERNAL_CONTRACT_CODE',
    );
  }
  throw new PlatformExternalContractError(contractCode.trim());
}
