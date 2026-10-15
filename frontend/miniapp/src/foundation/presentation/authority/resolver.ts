import {
  resolveControlPresentation,
  type ControlPresentation,
  type ControlSurface,
} from '../controls';
import {
  resolveControlFeedback,
  type ControlFeedbackPresentation,
} from '../feedback';
import {
  PRESENTATION_AVAILABILITIES,
  definePresentationRecipe,
  type PresentationAvailability,
  type PresentationIntent,
  type PresentationRecipe,
  type PresentationTone,
} from '../model';
import {
  resolveStatePresentation,
  type StatePresentation,
  type StatePresentationSurface,
} from '../states';
import {
  PlatformExternalContractError,
  isPlatformActionBindingOwned,
  isPlatformStateBindingOwned,
  type PlatformActionBinding,
  type PlatformAuthorityKind,
  type PlatformInteraction,
  type PlatformStateBinding,
} from './model';
import {
  isPlatformPresentationPolicyOwned,
  resolvePlatformPolicyOwner,
  type PlatformPresentationPolicy,
} from './policy';

export type PlatformResolvedStateBase = Readonly<{
  kind: 'state';
  binding: PlatformStateBinding;
  presentation: StatePresentation;
  recipe: PresentationRecipe;
}>;

export type PlatformResolvedActionBase = Readonly<{
  kind: 'action';
  binding: PlatformActionBinding;
  presentation: ControlPresentation;
  recipe: PresentationRecipe;
}>;

export type PlatformResolvedBase =
  | PlatformResolvedStateBase
  | PlatformResolvedActionBase;

export type PlatformResolvedPresentation = Readonly<{
  status: 'resolved';
  policyId: string;
  rootId: string;
  ownerRootId: string;
  role: string;
  authority: PlatformAuthorityKind;
  base: PlatformResolvedBase;
  interaction: PlatformInteraction;
  availability: PresentationAvailability;
  feedback: ControlFeedbackPresentation;
}>;

export type PlatformExternalFailure = Readonly<{
  status: 'external-error';
  policyId: string;
  rootId: string;
  ownerRootId: string;
  role: string;
  authority: PlatformAuthorityKind;
  contractCode: string;
}>;

export type PlatformPresentationResolution =
  | PlatformResolvedPresentation
  | PlatformExternalFailure;

export const PLATFORM_RESOLUTION_ERROR_CODES = Object.freeze([
  'INVALID_RESOLUTION_REQUEST',
  'UNKNOWN_RESOLUTION_REQUEST_FIELD',
  'INVALID_RESOLUTION_POLICY',
  'INVALID_RESOLUTION_ROOT_ID',
  'INVALID_INTERACTION',
  'UNKNOWN_INTERACTION_FIELD',
  'INVALID_AVAILABILITY',
  'AUTHORITY_BINDING_MISMATCH',
  'UNOWNED_AUTHORITY_BINDING',
] as const);

export type PlatformResolutionErrorCode =
  typeof PLATFORM_RESOLUTION_ERROR_CODES[number];

export class PlatformResolutionError extends Error {
  readonly code: PlatformResolutionErrorCode;

  constructor(code: PlatformResolutionErrorCode) {
    super(code);
    this.name = 'PlatformResolutionError';
    this.code = code;
    Object.freeze(this);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function interaction(value: unknown): PlatformInteraction {
  if (!isPlainObject(value)) {
    throw new PlatformResolutionError('INVALID_INTERACTION');
  }
  if (value.kind === 'inert') {
    for (const field of Object.keys(value)) {
      if (field !== 'kind') {
        throw new PlatformResolutionError('UNKNOWN_INTERACTION_FIELD');
      }
    }
    return Object.freeze({ kind: 'inert' as const });
  }
  if (value.kind === 'action') {
    for (const field of Object.keys(value)) {
      if (field !== 'kind' && field !== 'actionId') {
        throw new PlatformResolutionError('UNKNOWN_INTERACTION_FIELD');
      }
    }
    if (
      typeof value.actionId !== 'string' ||
      value.actionId.trim().length === 0
    ) {
      throw new PlatformResolutionError('INVALID_INTERACTION');
    }
    return Object.freeze({
      kind: 'action' as const,
      actionId: value.actionId.trim(),
    });
  }
  throw new PlatformResolutionError('INVALID_INTERACTION');
}

function availability(value: unknown): PresentationAvailability {
  if (
    typeof value !== 'string' ||
    !PRESENTATION_AVAILABILITIES.includes(
      value as PresentationAvailability,
    )
  ) {
    throw new PlatformResolutionError('INVALID_AVAILABILITY');
  }
  return value as PresentationAvailability;
}

function stateIntent(tone: PresentationTone): PresentationIntent {
  if (tone === 'positive' || tone === 'warning' || tone === 'danger') {
    return tone;
  }
  return 'neutral';
}

function stateBase(
  binding: PlatformStateBinding,
  surface: StatePresentationSurface,
): PlatformResolvedStateBase {
  const presentation = resolveStatePresentation({
    key: binding.key,
    surface,
  });
  const recipe = definePresentationRecipe({
    surface,
    intent: stateIntent(presentation.tone),
    emphasis: 'primary',
    fill: Object.freeze({
      mode: presentation.fillMode,
      tone: presentation.tone,
    }),
    borderTone: presentation.tone,
    textTone: presentation.tone,
    preserveStateToneWhenDisabled: true,
  });
  return Object.freeze({
    kind: 'state' as const,
    binding,
    presentation,
    recipe,
  });
}

function actionBase(
  binding: PlatformActionBinding,
  surface: ControlSurface,
): PlatformResolvedActionBase {
  const presentation = resolveControlPresentation({
    key: binding.key,
    surface,
  });
  return Object.freeze({
    kind: 'action' as const,
    binding,
    presentation,
    recipe: presentation.recipe,
  });
}

export function resolvePlatformPresentation(input: Readonly<{
  policy: PlatformPresentationPolicy;
  rootId: string;
  evidence: unknown;
  interaction: PlatformInteraction;
  availability: PresentationAvailability;
}>): PlatformPresentationResolution {
  if (!isPlainObject(input)) {
    throw new PlatformResolutionError('INVALID_RESOLUTION_REQUEST');
  }
  for (const field of Object.keys(input)) {
    if (
      field !== 'policy' &&
      field !== 'rootId' &&
      field !== 'evidence' &&
      field !== 'interaction' &&
      field !== 'availability'
    ) {
      throw new PlatformResolutionError(
        'UNKNOWN_RESOLUTION_REQUEST_FIELD',
      );
    }
  }
  if (!isPlatformPresentationPolicyOwned(input.policy)) {
    throw new PlatformResolutionError('INVALID_RESOLUTION_POLICY');
  }
  if (
    typeof input.rootId !== 'string' ||
    input.rootId.trim().length === 0
  ) {
    throw new PlatformResolutionError('INVALID_RESOLUTION_ROOT_ID');
  }
  const resolvedInteraction = interaction(input.interaction);
  const resolvedAvailability = availability(input.availability);
  const policyOwner = resolvePlatformPolicyOwner(
    input.policy,
    input.rootId.trim(),
  );

  let binding: unknown;
  try {
    binding = policyOwner.role.resolve(input.evidence);
  } catch (error: unknown) {
    if (error instanceof PlatformExternalContractError) {
      return Object.freeze({
        status: 'external-error' as const,
        policyId: input.policy.policyId,
        rootId: policyOwner.requestedRoot.rootId,
        ownerRootId: policyOwner.ownerRoot.rootId,
        role: policyOwner.role.role,
        authority: policyOwner.role.authority,
        contractCode: error.contractCode,
      });
    }
    throw error;
  }

  let base: PlatformResolvedBase;
  if (policyOwner.role.authority === 'ACTION') {
    if (!isPlatformActionBindingOwned(binding)) {
      throw new PlatformResolutionError(
        isPlatformStateBindingOwned(binding)
          ? 'AUTHORITY_BINDING_MISMATCH'
          : 'UNOWNED_AUTHORITY_BINDING',
      );
    }
    base = actionBase(
      binding,
      policyOwner.requestedRoot.surface as ControlSurface,
    );
  } else {
    if (!isPlatformStateBindingOwned(binding)) {
      throw new PlatformResolutionError(
        isPlatformActionBindingOwned(binding)
          ? 'AUTHORITY_BINDING_MISMATCH'
          : 'UNOWNED_AUTHORITY_BINDING',
      );
    }
    base = stateBase(
      binding,
      policyOwner.requestedRoot.surface as StatePresentationSurface,
    );
  }

  return Object.freeze({
    status: 'resolved' as const,
    policyId: input.policy.policyId,
    rootId: policyOwner.requestedRoot.rootId,
    ownerRootId: policyOwner.ownerRoot.rootId,
    role: policyOwner.role.role,
    authority: policyOwner.role.authority,
    base,
    interaction: resolvedInteraction,
    availability: resolvedAvailability,
    feedback: resolveControlFeedback({
      availability: resolvedAvailability,
      preserveToneWhenDisabled:
        base.recipe.preserveStateToneWhenDisabled,
    }),
  });
}
