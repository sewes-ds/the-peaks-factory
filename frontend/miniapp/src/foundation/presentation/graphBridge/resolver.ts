import {
  resolveControlPresentation,
  type ControlPresentation,
} from '../controls';
import {
  resolveContentFeedback,
  resolveControlFeedback,
  type ControlFeedbackPresentation,
} from '../feedback';
import {
  isPresentationFormDraftControllerOwned,
} from '../forms';
import {
  resolveStatePresentation,
  type StatePresentation,
} from '../states';
import {
  resolvePlatformPresentation,
  type PlatformInteraction,
} from '../authority';
import type { PresentationAvailability } from '../model';
import {
  resolvePresentationGraphContent,
  type ResolvedPresentationGraphContent,
} from './content';
import {
  PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS,
  PresentationGraphBridgeError,
  ownPresentationGraphBridgeItem,
  type ActionInteractionBinding,
  type BridgeInteractionBinding,
  type PresentationGraphBridge,
  type PresentationGraphBridgeErrorCode,
  type PresentationGraphAuthorityDiagnostics,
  type PresentationGraphBridgeView,
  type ResolvedPresentationGraphBridgeItem,
  type ResolvedPresentationGraphCardLine,
  type ResolvedPresentationGraphSecondaryLine,
} from './model';
import {
  isPresentationGraphExecutionPortOwned,
  type PresentationGraphExecutionPort,
} from './port';

type ResolvedInteraction = Readonly<{
  actionId: string | null;
  actionClass: 'business' | 'presentation' | null;
  availability: 'enabled' | 'disabled' | 'inert' | 'pending';
  onPress: (() => void) | undefined;
}>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function error(
  code: PresentationGraphBridgeErrorCode,
  renderId?: string,
  actionId?: string,
  originalError?: unknown,
): PresentationGraphBridgeError {
  return new PresentationGraphBridgeError(code, {
    ...(renderId === undefined ? {} : { renderId }),
    ...(actionId === undefined ? {} : { actionId }),
    ...(originalError === undefined ? {} : { originalError }),
  });
}

function rejectUnknownFields(
  input: Record<string, unknown>,
  allowed: readonly string[],
  code: PresentationGraphBridgeErrorCode,
  renderId?: string,
): void {
  for (const field of Object.keys(input)) {
    if (!allowed.includes(field)) {
      throw error(code, renderId);
    }
  }
}

function renderIdentity(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw error('INVALID_RENDER_ID');
  }
  return value;
}

function localIdentity(
  value: unknown,
  code: 'INVALID_SECONDARY_LINES' | 'INVALID_CARD_LINES',
  renderId: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw error(code, renderId);
  }
  return value;
}

function ariaLabel(value: unknown, renderId: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw error('INVALID_ARIA_LABEL', renderId);
  }
  return value;
}

function content(
  value: unknown,
  renderId: string,
): ResolvedPresentationGraphContent {
  try {
    return resolvePresentationGraphContent(value);
  } catch (originalError) {
    throw error(
      'INVALID_GRAPH_BRIDGE_ITEM',
      renderId,
      undefined,
      originalError,
    );
  }
}

function control(
  key: unknown,
  surface: 'action-button' | 'list-button',
  renderId: string,
): ControlPresentation {
  try {
    return resolveControlPresentation({ key, surface });
  } catch (originalError) {
    throw error(
      'INVALID_CONTROL_BINDING',
      renderId,
      undefined,
      originalError,
    );
  }
}

function state(
  key: unknown,
  surface: StatePresentation['surface'],
  renderId: string,
): StatePresentation {
  try {
    return resolveStatePresentation({ key, surface });
  } catch (originalError) {
    throw error(
      'INVALID_STATE_BINDING',
      renderId,
      undefined,
      originalError,
    );
  }
}

type AuthorityAppearance<TPresentation> = Readonly<{
  presentation: TPresentation;
  feedback: ControlFeedbackPresentation;
  diagnostics: PresentationGraphAuthorityDiagnostics;
}>;

function authorityAppearance<TPresentation extends StatePresentation | ControlPresentation>(
  value: unknown,
  surface: TPresentation['surface'],
  expectedKind: 'state' | 'action',
  resolvedInteraction: ResolvedInteraction,
  renderId: string,
): AuthorityAppearance<TPresentation> {
  if (!isPlainObject(value)) {
    throw error('INVALID_PRESENTATION_AUTHORITY', renderId);
  }
  rejectUnknownFields(
    value,
    ['policy', 'rootId', 'evidence'],
    'INVALID_PRESENTATION_AUTHORITY',
    renderId,
  );
  if (typeof value.rootId !== 'string' || value.rootId.trim().length === 0) {
    throw error('INVALID_PRESENTATION_AUTHORITY', renderId);
  }
  const interaction: PlatformInteraction = resolvedInteraction.actionId === null
    ? Object.freeze({ kind: 'inert' as const })
    : Object.freeze({
        kind: 'action' as const,
        actionId: resolvedInteraction.actionId,
      });
  let resolution;
  try {
    resolution = resolvePlatformPresentation({
      policy: value.policy as never,
      rootId: value.rootId,
      evidence: value.evidence,
      interaction,
      availability: resolvedInteraction.availability as PresentationAvailability,
    });
  } catch (originalError) {
    throw error(
      'INVALID_PRESENTATION_AUTHORITY',
      renderId,
      resolvedInteraction.actionId ?? undefined,
      originalError,
    );
  }
  if (resolution.status === 'external-error') {
    throw error(
      'PRESENTATION_AUTHORITY_EXTERNAL_ERROR',
      renderId,
      resolvedInteraction.actionId ?? undefined,
      resolution,
    );
  }
  if (
    resolution.base.kind !== expectedKind ||
    resolution.base.presentation.surface !== surface
  ) {
    throw error('INVALID_PRESENTATION_AUTHORITY', renderId);
  }
  return Object.freeze({
    presentation: resolution.base.presentation as TPresentation,
    feedback: resolution.feedback,
    diagnostics: Object.freeze({
      policyId: resolution.policyId,
      rootId: resolution.rootId,
      ownerRootId: resolution.ownerRootId,
      role: resolution.role,
      authority: resolution.authority,
    }),
  });
}

const inertResolution = Object.freeze({
  actionId: null,
  actionClass: null,
  availability: 'inert' as const,
  onPress: undefined,
});

function stateAppearance<TSurface extends StatePresentation['surface']>(
  value: Readonly<Record<string, unknown>>,
  surface: TSurface,
  resolvedInteraction: ResolvedInteraction,
  renderId: string,
): Readonly<{
  presentation: StatePresentation & Readonly<{ surface: TSurface }>;
  feedback: ControlFeedbackPresentation;
  diagnostics?: PresentationGraphAuthorityDiagnostics;
}> {
  const hasRaw = value.stateKey !== undefined;
  const hasAuthority = value.presentationAuthority !== undefined;
  if (hasRaw === hasAuthority) {
    throw error('INVALID_PRESENTATION_AUTHORITY', renderId);
  }
  if (hasAuthority) {
    return authorityAppearance<
      StatePresentation & Readonly<{ surface: TSurface }>
    >(
      value.presentationAuthority,
      surface,
      'state',
      resolvedInteraction,
      renderId,
    );
  }
  const presentation = state(value.stateKey, surface, renderId) as
    StatePresentation & Readonly<{ surface: TSurface }>;
  return Object.freeze({
    presentation,
    feedback: feedback(
      resolvedInteraction.availability,
      presentation.preserveToneWhenDisabled,
      renderId,
    ),
  });
}

function controlAppearance<TSurface extends ControlPresentation['surface']>(
  value: Readonly<Record<string, unknown>>,
  surface: TSurface,
  resolvedInteraction: ResolvedInteraction,
  renderId: string,
): Readonly<{
  presentation: ControlPresentation & Readonly<{ surface: TSurface }>;
  feedback: ControlFeedbackPresentation;
  diagnostics?: PresentationGraphAuthorityDiagnostics;
}> {
  const hasRaw = value.controlKey !== undefined;
  const hasAuthority = value.presentationAuthority !== undefined;
  if (hasRaw === hasAuthority) {
    throw error('INVALID_PRESENTATION_AUTHORITY', renderId);
  }
  if (hasAuthority) {
    return authorityAppearance<
      ControlPresentation & Readonly<{ surface: TSurface }>
    >(
      value.presentationAuthority,
      surface,
      'action',
      resolvedInteraction,
      renderId,
    );
  }
  return Object.freeze({
    presentation: control(value.controlKey, surface, renderId) as
      ControlPresentation & Readonly<{ surface: TSurface }>,
    feedback: feedback(resolvedInteraction.availability, false, renderId),
  });
}

function feedback(
  availability: ResolvedInteraction['availability'],
  preserveToneWhenDisabled: boolean,
  renderId: string,
): ControlFeedbackPresentation {
  try {
    return resolveControlFeedback({
      availability,
      preserveToneWhenDisabled,
    });
  } catch (originalError) {
    throw error(
      'INVALID_GRAPH_BRIDGE_ITEM',
      renderId,
      undefined,
      originalError,
    );
  }
}

function validateDescriptor(
  descriptor: unknown,
  port: PresentationGraphExecutionPort,
  renderId: string,
): Readonly<{
  actionId: string;
  actionClass: 'business' | 'presentation';
}> {
  if (
    !isPlainObject(descriptor) ||
    descriptor.kind !== 'graph-runtime-action-descriptor' ||
    typeof descriptor.activationId !== 'number' ||
    typeof descriptor.nodeId !== 'string' ||
    (descriptor.actionClass !== 'business' &&
      descriptor.actionClass !== 'presentation') ||
    typeof descriptor.actionId !== 'string' ||
    descriptor.actionId.trim().length === 0
  ) {
    throw error('INVALID_ACTION_DESCRIPTOR', renderId);
  }
  if (
    descriptor.activationId !== port.activationId ||
    descriptor.nodeId !== port.nodeId
  ) {
    throw error(
      'ACTION_DESCRIPTOR_MISMATCH',
      renderId,
      descriptor.actionId,
    );
  }
  return Object.freeze({
    actionId: descriptor.actionId,
    actionClass: descriptor.actionClass,
  });
}

function resolveInteraction(
  value: unknown,
  port: PresentationGraphExecutionPort,
  interactionPending: boolean,
  renderId: string,
  callbacks: WeakMap<object, () => void>,
  actionRequired: boolean,
): ResolvedInteraction {
  if (!isPlainObject(value)) {
    throw error('INVALID_INTERACTION_BINDING', renderId);
  }
  if (value.kind === 'inert') {
    for (const field of Object.keys(value)) {
      if (field === 'action' || field === 'baseAvailability') {
        throw error('ACTION_FORBIDDEN', renderId);
      }
      if (field !== 'kind') {
        throw error('UNKNOWN_INTERACTION_BINDING_FIELD', renderId);
      }
    }
    if (actionRequired) {
      throw error('ACTION_REQUIRED', renderId);
    }
    return Object.freeze({
      actionId: null,
      actionClass: null,
      availability: 'inert',
      onPress: undefined,
    });
  }
  if (value.kind !== 'action') {
    throw error('INVALID_INTERACTION_BINDING', renderId);
  }
  rejectUnknownFields(
    value,
    ['kind', 'action', 'baseAvailability'],
    'UNKNOWN_INTERACTION_BINDING_FIELD',
    renderId,
  );
  if (
    typeof value.action !== 'object' ||
    value.action === null ||
    Array.isArray(value.action)
  ) {
    throw error('ACTION_REQUIRED', renderId);
  }
  if (
    value.baseAvailability !== 'enabled' &&
    value.baseAvailability !== 'disabled'
  ) {
    throw error('INVALID_BASE_AVAILABILITY', renderId);
  }

  let descriptor: unknown;
  try {
    descriptor = port.describe(value.action);
  } catch (originalError) {
    throw error('ACTION_NOT_OWNED', renderId, undefined, originalError);
  }
  const diagnostics = validateDescriptor(descriptor, port, renderId);
  let callback = callbacks.get(value.action);
  if (callback === undefined) {
    const exactAction = value.action;
    callback = () => {
      void port.execute(exactAction);
    };
    callbacks.set(exactAction, callback);
  }
  const availability =
    value.baseAvailability === 'enabled' && interactionPending
      ? 'pending'
      : value.baseAvailability;
  return Object.freeze({
    actionId: diagnostics.actionId,
    actionClass: diagnostics.actionClass,
    availability,
    onPress: availability === 'enabled' ? callback : undefined,
  });
}

function summaryLines(
  value: unknown,
  renderId: string,
): readonly ResolvedPresentationGraphSecondaryLine[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw error('INVALID_SECONDARY_LINES', renderId);
  }
  const ids = new Set<string>();
  const lines = value.map((candidate) => {
    if (!isPlainObject(candidate)) {
      throw error('INVALID_SECONDARY_LINES', renderId);
    }
    rejectUnknownFields(
      candidate,
      ['id', 'stateKey', 'presentationAuthority', 'content'],
      'INVALID_SECONDARY_LINES',
      renderId,
    );
    const id = localIdentity(
      candidate.id,
      'INVALID_SECONDARY_LINES',
      renderId,
    );
    if (ids.has(id)) {
      throw error('DUPLICATE_SECONDARY_LINE_ID', renderId);
    }
    ids.add(id);
    const appearance = stateAppearance(
      candidate,
      'summary-line',
      inertResolution,
      renderId,
    );
    return Object.freeze({
      id,
      presentation: appearance.presentation,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      content: content(candidate.content, renderId),
    });
  });
  return Object.freeze(lines);
}

function cardLines(
  value: unknown,
  renderId: string,
): readonly ResolvedPresentationGraphCardLine[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw error('INVALID_CARD_LINES', renderId);
  }
  const ids = new Set<string>();
  const lines = value.map((candidate) => {
    if (!isPlainObject(candidate)) {
      throw error('INVALID_CARD_LINES', renderId);
    }
    const id = localIdentity(candidate.id, 'INVALID_CARD_LINES', renderId);
    if (ids.has(id)) {
      throw error('DUPLICATE_CARD_LINE_ID', renderId);
    }
    ids.add(id);
    const fields = Object.keys(candidate);
    if (
      fields.length === 3 &&
      fields.includes('id') &&
      fields.includes('label') &&
      fields.includes('value')
    ) {
      return Object.freeze({
        id,
        label: content(candidate.label, renderId),
        value: content(candidate.value, renderId),
      });
    }
    if (
      fields.length === 2 &&
      fields.includes('id') &&
      fields.includes('content')
    ) {
      return Object.freeze({
        id,
        content: content(candidate.content, renderId),
      });
    }
    throw error('INVALID_CARD_LINES', renderId);
  });
  return Object.freeze(lines);
}

function own(
  item: ResolvedPresentationGraphBridgeItem,
): ResolvedPresentationGraphBridgeItem {
  return ownPresentationGraphBridgeItem(
    Object.freeze(item) as ResolvedPresentationGraphBridgeItem,
  );
}

function resolveItem(
  input: unknown,
  port: PresentationGraphExecutionPort,
  interactionPending: boolean,
  callbacks: WeakMap<object, () => void>,
): ResolvedPresentationGraphBridgeItem {
  if (!isPlainObject(input)) {
    throw error('INVALID_GRAPH_BRIDGE_ITEM');
  }
  if (
    typeof input.kind !== 'string' ||
    !PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS.includes(
      input.kind as typeof PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS[number],
    )
  ) {
    throw error('INVALID_GRAPH_BRIDGE_ITEM_KIND');
  }
  const id = renderIdentity(input.id);

  if (input.kind === 'control-action-button') {
    rejectUnknownFields(
      input,
      ['kind', 'id', 'interaction', 'controlKey', 'presentationAuthority', 'label', 'ariaLabel'],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    const interaction = resolveInteraction(
      input.interaction,
      port,
      interactionPending,
      id,
      callbacks,
      false,
    );
    const appearance = controlAppearance(
      input,
      'action-button',
      interaction,
      id,
    );
    return own({
      kind: 'control-action-button',
      id,
      actionId: interaction.actionId,
      actionClass: interaction.actionClass,
      presentation: appearance.presentation,
      feedback: appearance.feedback,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      label: content(input.label, id),
      ...(ariaLabel(input.ariaLabel, id) === undefined
        ? {}
        : { ariaLabel: ariaLabel(input.ariaLabel, id) }),
      onPress: interaction.onPress,
    });
  }

  if (input.kind === 'control-list-button') {
    rejectUnknownFields(
      input,
      [
        'kind',
        'id',
        'interaction',
        'controlKey',
        'presentationAuthority',
        'mainLine',
        'secondaryLine',
        'secondaryLines',
        'ariaLabel',
      ],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    if (
      input.secondaryLine !== undefined &&
      input.secondaryLines !== undefined
    ) {
      throw error('INVALID_SECONDARY_CONTENT', id);
    }
    const interaction = resolveInteraction(
      input.interaction,
      port,
      interactionPending,
      id,
      callbacks,
      true,
    );
    const appearance = controlAppearance(
      input,
      'list-button',
      interaction,
      id,
    );
    const resolvedAria = ariaLabel(input.ariaLabel, id);
    return own({
      kind: 'control-list-button',
      id,
      actionId: interaction.actionId as string,
      actionClass: interaction.actionClass as 'business' | 'presentation',
      presentation: appearance.presentation,
      feedback: appearance.feedback,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      mainLine: content(input.mainLine, id),
      ...(input.secondaryLine === undefined
        ? {}
        : { secondaryLine: content(input.secondaryLine, id) }),
      ...(input.secondaryLines === undefined
        ? {}
        : { secondaryLines: summaryLines(input.secondaryLines, id) }),
      ...(resolvedAria === undefined ? {} : { ariaLabel: resolvedAria }),
      onPress: interaction.onPress,
    });
  }

  if (input.kind === 'state-list-button') {
    rejectUnknownFields(
      input,
      [
        'kind',
        'id',
        'stateKey',
        'presentationAuthority',
        'interaction',
        'mainLine',
        'secondaryLine',
        'secondaryLines',
        'ariaLabel',
      ],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    if (
      input.secondaryLine !== undefined &&
      input.secondaryLines !== undefined
    ) {
      throw error('INVALID_SECONDARY_CONTENT', id);
    }
    const interaction = resolveInteraction(
      input.interaction,
      port,
      interactionPending,
      id,
      callbacks,
      false,
    );
    const appearance = stateAppearance(
      input,
      'list-button',
      interaction,
      id,
    );
    const resolvedAria = ariaLabel(input.ariaLabel, id);
    return own({
      kind: input.kind,
      id,
      actionId: interaction.actionId,
      actionClass: interaction.actionClass,
      presentation: appearance.presentation,
      feedback: appearance.feedback,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      mainLine: content(input.mainLine, id),
      ...(input.secondaryLine === undefined
        ? {}
        : { secondaryLine: content(input.secondaryLine, id) }),
      ...(input.secondaryLines === undefined
        ? {}
        : { secondaryLines: summaryLines(input.secondaryLines, id) }),
      ...(resolvedAria === undefined ? {} : { ariaLabel: resolvedAria }),
      onPress: interaction.onPress,
    });
  }

  if (input.kind === 'entity-row') {
    rejectUnknownFields(
      input,
      [
        'kind',
        'id',
        'stateKey',
        'presentationAuthority',
        'interaction',
        'primary',
        'secondary',
        'ariaLabel',
      ],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    const interaction = resolveInteraction(
      input.interaction,
      port,
      interactionPending,
      id,
      callbacks,
      false,
    );
    const appearance = stateAppearance(
      input,
      'entity-row',
      interaction,
      id,
    );
    const resolvedAria = ariaLabel(input.ariaLabel, id);
    return own({
      kind: input.kind,
      id,
      actionId: interaction.actionId,
      actionClass: interaction.actionClass,
      presentation: appearance.presentation,
      feedback: appearance.feedback,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      primary: content(input.primary, id),
      ...(input.secondary === undefined
        ? {}
        : { secondary: content(input.secondary, id) }),
      ...(resolvedAria === undefined ? {} : { ariaLabel: resolvedAria }),
      onPress: interaction.onPress,
    });
  }

  if (input.kind === 'card') {
    rejectUnknownFields(
      input,
      ['kind', 'id', 'stateKey', 'presentationAuthority', 'interaction', 'title', 'lines', 'ariaLabel'],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    const interaction = input.interaction === undefined
      ? inertResolution
      : resolveInteraction(
          input.interaction,
          port,
          interactionPending,
          id,
          callbacks,
          true,
        );
    const resolvedAria = ariaLabel(input.ariaLabel, id);
    const appearance = stateAppearance(input, 'card', interaction, id);
    return own({
      kind: input.kind,
      id,
      actionId: interaction.actionId,
      actionClass: interaction.actionClass,
      presentation: appearance.presentation,
      feedback: appearance.feedback,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      ...(input.title === undefined
        ? {}
        : { title: content(input.title, id) }),
      lines: cardLines(input.lines, id),
      ...(resolvedAria === undefined ? {} : { ariaLabel: resolvedAria }),
      onPress: interaction.onPress,
    });
  }

  if (input.kind === 'summary-line') {
    rejectUnknownFields(
      input,
      ['kind', 'id', 'stateKey', 'presentationAuthority', 'content', 'ariaLabel'],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    const resolvedAria = ariaLabel(input.ariaLabel, id);
    const appearance = stateAppearance(
      input,
      'summary-line',
      inertResolution,
      id,
    );
    return own({
      kind: input.kind,
      id,
      presentation: appearance.presentation,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      content: content(input.content, id),
      ...(resolvedAria === undefined ? {} : { ariaLabel: resolvedAria }),
    });
  }

  if (input.kind === 'message') {
    rejectUnknownFields(
      input,
      [
        'kind',
        'id',
        'stateKey',
        'presentationAuthority',
        'content',
        'ariaLabel',
        'role',
        'ariaLive',
        'ariaBusy',
      ],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    if (
      (input.role !== undefined &&
        input.role !== 'status' &&
        input.role !== 'alert') ||
      (input.ariaLive !== undefined &&
        input.ariaLive !== 'polite' &&
        input.ariaLive !== 'assertive') ||
      (input.ariaBusy !== undefined &&
        typeof input.ariaBusy !== 'boolean')
    ) {
      throw error('INVALID_MESSAGE_ARIA', id);
    }
    const resolvedAria = ariaLabel(input.ariaLabel, id);
    const appearance = stateAppearance(input, 'message', inertResolution, id);
    return own({
      kind: input.kind,
      id,
      presentation: appearance.presentation,
      ...(appearance.diagnostics === undefined
        ? {}
        : { presentationAuthority: appearance.diagnostics }),
      content: content(input.content, id),
      ...(resolvedAria === undefined ? {} : { ariaLabel: resolvedAria }),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.ariaLive === undefined
        ? {}
        : { ariaLive: input.ariaLive }),
      ...(input.ariaBusy === undefined
        ? {}
        : { ariaBusy: input.ariaBusy }),
    });
  }

  if (input.kind === 'form-field') {
    rejectUnknownFields(
      input,
      ['kind', 'id', 'controller', 'fieldId'],
      'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
      id,
    );
    if (
      !isPresentationFormDraftControllerOwned(input.controller) ||
      typeof input.fieldId !== 'string' ||
      input.fieldId.trim().length === 0
    ) {
      throw error('INVALID_FORM_BINDING', id);
    }
    let field;
    try {
      field = input.controller.field(input.fieldId);
    } catch (originalError) {
      throw error('INVALID_FORM_BINDING', id, undefined, originalError);
    }
    const controller = input.controller;
    const fieldId = input.fieldId;
    return own({
      kind: 'form-field',
      id,
      field,
      onValueChange: (value: string) => controller.setValue(fieldId, value),
    });
  }

  rejectUnknownFields(
    input,
    ['kind', 'id', 'feedbackKind', 'message', 'retry'],
    'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
    id,
  );
  let presentation;
  try {
    presentation = resolveContentFeedback({ kind: input.feedbackKind });
  } catch (originalError) {
    throw error(
      'INVALID_GRAPH_BRIDGE_ITEM',
      id,
      undefined,
      originalError,
    );
  }
  if (presentation.kind === 'recoverable-error') {
    if (!isPlainObject(input.retry)) {
      throw error('RETRY_BINDING_REQUIRED', id);
    }
    rejectUnknownFields(
      input.retry,
      ['interaction', 'label'],
      'INVALID_GRAPH_BRIDGE_ITEM',
      id,
    );
    const interaction = resolveInteraction(
      input.retry.interaction,
      port,
      interactionPending,
      id,
      callbacks,
      true,
    );
    return own({
      kind: 'feedback-block',
      id,
      presentation,
      message: content(input.message, id),
      retryLabel: content(input.retry.label, id),
      retryFeedback: feedback(interaction.availability, false, id),
      actionId: interaction.actionId,
      actionClass: interaction.actionClass,
      onRetry: interaction.onPress ?? null,
    });
  }
  if (input.retry !== undefined) {
    throw error('RETRY_BINDING_FORBIDDEN', id);
  }
  return own({
    kind: 'feedback-block',
    id,
    presentation,
    message: content(input.message, id),
    retryLabel: null,
    retryFeedback: null,
    actionId: null,
    actionClass: null,
    onRetry: null,
  });
}

export function createPresentationGraphBridge(
  port: unknown,
): PresentationGraphBridge {
  if (!isPresentationGraphExecutionPortOwned(port)) {
    throw error('INVALID_GRAPH_BRIDGE_PORT');
  }
  const callbacks = new WeakMap<object, () => void>();
  const resolve = (
    projection: unknown,
    options: unknown,
  ): PresentationGraphBridgeView => {
    if (!isPlainObject(projection)) {
      throw error('INVALID_GRAPH_BRIDGE_PROJECTION');
    }
    rejectUnknownFields(
      projection,
      ['nodeId', 'items'],
      'UNKNOWN_GRAPH_BRIDGE_PROJECTION_FIELD',
    );
    if (
      typeof projection.nodeId !== 'string' ||
      projection.nodeId.trim().length === 0 ||
      !Array.isArray(projection.items)
    ) {
      throw error('INVALID_GRAPH_BRIDGE_PROJECTION');
    }
    if (projection.nodeId !== port.nodeId) {
      throw error('GRAPH_BRIDGE_NODE_MISMATCH');
    }
    if (!isPlainObject(options)) {
      throw error('INVALID_GRAPH_BRIDGE_OPTIONS');
    }
    rejectUnknownFields(
      options,
      ['interactionPending'],
      'UNKNOWN_GRAPH_BRIDGE_OPTION_FIELD',
    );
    if (typeof options.interactionPending !== 'boolean') {
      throw error('INVALID_INTERACTION_PENDING');
    }

    const ids = new Set<string>();
    const items = projection.items.map((item) => {
      const resolved = resolveItem(
        item,
        port,
        options.interactionPending as boolean,
        callbacks,
      );
      if (ids.has(resolved.id)) {
        throw error('DUPLICATE_RENDER_ID', resolved.id);
      }
      ids.add(resolved.id);
      return resolved;
    });
    return Object.freeze({
      nodeId: projection.nodeId,
      items: Object.freeze(items),
    });
  };
  return Object.freeze({
    port,
    resolve,
  });
}
