import type {
  ControlSemanticKey,
  ControlSurface,
} from '../../foundation/presentation';

export const SECTION03_CONTROL_ROLES = Object.freeze([
  'open-machines',
  'back',
  'open-operational-downtime-finish',
  'finish-operational-downtime',
] as const);

export type Section03ControlRole =
  typeof SECTION03_CONTROL_ROLES[number];

export type Section03ControlBinding = Readonly<{
  role: Section03ControlRole;
  controlKey: ControlSemanticKey;
  surface: ControlSurface;
}>;

export const SECTION03_CONTROL_BINDING_ERROR_CODES = Object.freeze([
  'INVALID_SECTION03_CONTROL_BINDING',
  'UNKNOWN_SECTION03_CONTROL_BINDING_FIELD',
  'INVALID_SECTION03_CONTROL_ROLE',
] as const);

export type Section03ControlBindingErrorCode =
  typeof SECTION03_CONTROL_BINDING_ERROR_CODES[number];

export class Section03ControlBindingError extends Error {
  readonly code: Section03ControlBindingErrorCode;

  constructor(code: Section03ControlBindingErrorCode) {
    super(code);
    this.name = 'Section03ControlBindingError';
    this.code = code;
    Object.freeze(this);
  }
}

const registry: Readonly<
  Record<Section03ControlRole, Section03ControlBinding>
> = Object.freeze({
  'open-machines': Object.freeze({
    role: 'open-machines',
    controlKey: 'navigation-open',
    surface: 'list-button',
  }),
  back: Object.freeze({
    role: 'back',
    controlKey: 'navigation-back',
    surface: 'action-button',
  }),
  'open-operational-downtime-finish': Object.freeze({
    role: 'open-operational-downtime-finish',
    controlKey: 'action-warning',
    surface: 'action-button',
  }),
  'finish-operational-downtime': Object.freeze({
    role: 'finish-operational-downtime',
    controlKey: 'action-warning',
    surface: 'action-button',
  }),
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRole(value: unknown): value is Section03ControlRole {
  return (
    typeof value === 'string' &&
    SECTION03_CONTROL_ROLES.includes(value as Section03ControlRole)
  );
}

export function resolveSection03ControlBinding(
  input: unknown,
): Section03ControlBinding {
  if (!isPlainObject(input)) {
    throw new Section03ControlBindingError(
      'INVALID_SECTION03_CONTROL_BINDING',
    );
  }
  for (const field of Object.keys(input)) {
    if (field !== 'role') {
      throw new Section03ControlBindingError(
        'UNKNOWN_SECTION03_CONTROL_BINDING_FIELD',
      );
    }
  }
  if (!isRole(input.role)) {
    throw new Section03ControlBindingError(
      'INVALID_SECTION03_CONTROL_ROLE',
    );
  }
  return registry[input.role];
}
