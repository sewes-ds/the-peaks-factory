import type { ReactNode } from 'react';

import type {
  ControlPresentation,
} from '../controls';
import type {
  ControlFeedbackPresentation,
  ContentFeedbackPresentation,
} from '../feedback';
import type {
  StatePresentation,
} from '../states';

export const PRESENTATION_PRIMITIVE_ERROR_CODES = Object.freeze([
  'INVALID_PRIMITIVE_PRESENTATION',
  'CONTROL_SURFACE_MISMATCH',
  'STATE_SURFACE_MISMATCH',
  'INTERACTIVE_HANDLER_REQUIRED',
  'INERT_HANDLER_FORBIDDEN',
  'EMPTY_CARD_LINES',
  'RETRY_PRESENTATION_REQUIRED',
  'RETRY_PRESENTATION_FORBIDDEN',
  'RETRY_HANDLER_REQUIRED',
  'RETRY_HANDLER_FORBIDDEN',
] as const);

export type PresentationPrimitiveErrorCode =
  typeof PRESENTATION_PRIMITIVE_ERROR_CODES[number];

export class PresentationPrimitiveError extends Error {
  readonly code: PresentationPrimitiveErrorCode;

  constructor(code: PresentationPrimitiveErrorCode) {
    super(code);
    this.name = 'PresentationPrimitiveError';
    this.code = code;
    Object.freeze(this);
  }
}

export type ActionButtonControlPresentation = ControlPresentation & Readonly<{
  surface: 'action-button';
}>;

export type ListButtonControlPresentation = ControlPresentation & Readonly<{
  surface: 'list-button';
}>;

export type ListButtonStatePresentation = StatePresentation & Readonly<{
  surface: 'list-button';
}>;

export type EntityRowStatePresentation = StatePresentation & Readonly<{
  surface: 'entity-row';
}>;

export type CardStatePresentation = StatePresentation & Readonly<{
  surface: 'card';
}>;

export type SummaryLineStatePresentation = StatePresentation & Readonly<{
  surface: 'summary-line';
}>;

export type MessageStatePresentation = StatePresentation & Readonly<{
  surface: 'message';
}>;

export type PresentationCardLabeledLine = Readonly<{
  label: ReactNode;
  value: ReactNode;
}>;

export type PresentationCardContentLine = Readonly<{
  content: ReactNode;
}>;

export type PresentationCardLine =
  | PresentationCardLabeledLine
  | PresentationCardContentLine;

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (!isObject(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isControlPresentation(value: unknown): value is ControlPresentation {
  if (!isObject(value) || !isObject(value.tokens)) {
    return false;
  }
  return (
    typeof value.key === 'string' &&
    (value.surface === 'action-button' || value.surface === 'list-button') &&
    isObject(value.recipe) &&
    typeof value.tokens.background === 'string' &&
    typeof value.tokens.border === 'string' &&
    typeof value.tokens.text === 'string' &&
    Object.isFrozen(value) &&
    Object.isFrozen(value.tokens)
  );
}

function isStatePresentation(value: unknown): value is StatePresentation {
  if (!isObject(value) || !isObject(value.tokens)) {
    return false;
  }
  return (
    typeof value.key === 'string' &&
    typeof value.surface === 'string' &&
    typeof value.tokens.background === 'string' &&
    typeof value.tokens.border === 'string' &&
    typeof value.tokens.text === 'string' &&
    typeof value.tokens.marker === 'string' &&
    value.preserveToneWhenDisabled === true &&
    Object.isFrozen(value) &&
    Object.isFrozen(value.tokens)
  );
}

function isControlFeedback(
  value: unknown,
): value is ControlFeedbackPresentation {
  if (!isObject(value) || !Object.isFrozen(value)) {
    return false;
  }
  return (
    ['enabled', 'disabled', 'inert', 'pending'].includes(
      String(value.availability),
    ) &&
    typeof value.interactive === 'boolean' &&
    typeof value.nativeDisabled === 'boolean' &&
    typeof value.ariaDisabled === 'boolean' &&
    typeof value.ariaBusy === 'boolean' &&
    (value.visualTreatment === 'full' ||
      value.visualTreatment === 'muted') &&
    (value.progress === 'none' || value.progress === 'spinner') &&
    (value.live === 'off' || value.live === 'polite')
  );
}

export function assertControlSurface<TSurface extends 'action-button' | 'list-button'>(
  presentation: unknown,
  surface: TSurface,
): asserts presentation is ControlPresentation & Readonly<{
  surface: TSurface;
}> {
  if (!isControlPresentation(presentation)) {
    throw new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION');
  }
  if (presentation.surface !== surface) {
    throw new PresentationPrimitiveError('CONTROL_SURFACE_MISMATCH');
  }
}

export function assertStateSurface<
  TSurface extends StatePresentation['surface'],
>(
  presentation: unknown,
  surface: TSurface,
): asserts presentation is StatePresentation & Readonly<{
  surface: TSurface;
}> {
  if (!isStatePresentation(presentation)) {
    throw new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION');
  }
  if (presentation.surface !== surface) {
    throw new PresentationPrimitiveError('STATE_SURFACE_MISMATCH');
  }
}

export function interactiveHandler(
  feedback: unknown,
  handler: (() => void) | undefined,
): (() => void) | undefined {
  if (
    !isControlFeedback(feedback) ||
    (handler !== undefined && typeof handler !== 'function')
  ) {
    throw new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION');
  }
  if (feedback.availability === 'enabled') {
    if (handler === undefined) {
      throw new PresentationPrimitiveError(
        'INTERACTIVE_HANDLER_REQUIRED',
      );
    }
    return handler;
  }
  if (feedback.availability === 'inert' && handler !== undefined) {
    throw new PresentationPrimitiveError('INERT_HANDLER_FORBIDDEN');
  }
  return undefined;
}

export function assertCardLines(
  lines: readonly PresentationCardLine[],
): void {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new PresentationPrimitiveError('EMPTY_CARD_LINES');
  }
  for (const line of lines as readonly unknown[]) {
    if (!isPlainObject(line)) {
      throw new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION');
    }
    const fields = Object.keys(line);
    const labeled = (
      fields.length === 2 &&
      fields.includes('label') &&
      fields.includes('value')
    );
    const contentOnly = fields.length === 1 && fields[0] === 'content';
    if (!labeled && !contentOnly) {
      throw new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION');
    }
  }
}

export function assertContentFeedback(
  presentation: unknown,
): asserts presentation is ContentFeedbackPresentation {
  if (
    !isObject(presentation) ||
    !Object.isFrozen(presentation) ||
    !isStatePresentation(presentation.state) ||
    typeof presentation.kind !== 'string' ||
    !['status', 'alert'].includes(String(presentation.ariaRole)) ||
    !['polite', 'assertive'].includes(String(presentation.ariaLive)) ||
    typeof presentation.ariaBusy !== 'boolean' ||
    (presentation.retryControl !== null &&
      !isControlPresentation(presentation.retryControl))
  ) {
    throw new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION');
  }
}

export function retryHandler(
  presentation: ContentFeedbackPresentation,
  retryLabel: ReactNode | undefined,
  retryFeedback: ControlFeedbackPresentation | undefined,
  handler: (() => void) | undefined,
): (() => void) | undefined {
  assertContentFeedback(presentation);

  if (presentation.retryControl === null) {
    if (retryLabel !== undefined || retryFeedback !== undefined) {
      throw new PresentationPrimitiveError(
        'RETRY_PRESENTATION_FORBIDDEN',
      );
    }
    if (handler !== undefined) {
      throw new PresentationPrimitiveError('RETRY_HANDLER_FORBIDDEN');
    }
    return undefined;
  }

  if (retryLabel === undefined || retryFeedback === undefined) {
    throw new PresentationPrimitiveError('RETRY_PRESENTATION_REQUIRED');
  }
  if (!isControlFeedback(retryFeedback)) {
    throw new PresentationPrimitiveError('INVALID_PRIMITIVE_PRESENTATION');
  }
  if (retryFeedback.availability === 'enabled') {
    if (handler === undefined) {
      throw new PresentationPrimitiveError('RETRY_HANDLER_REQUIRED');
    }
    return handler;
  }
  if (retryFeedback.availability === 'inert' && handler !== undefined) {
    throw new PresentationPrimitiveError('RETRY_HANDLER_FORBIDDEN');
  }
  return undefined;
}
