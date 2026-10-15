import {
  resolveControlPresentation,
  type ControlPresentation,
} from '../controls';
import {
  resolveStatePresentation,
  type StatePresentation,
} from '../states';

export const CONTENT_FEEDBACK_KINDS = Object.freeze([
  'loading',
  'empty',
  'success',
  'recoverable-error',
  'terminal-error',
] as const);

export type ContentFeedbackKind = typeof CONTENT_FEEDBACK_KINDS[number];
export type ContentFeedbackAriaRole = 'status' | 'alert';
export type ContentFeedbackAriaLive = 'polite' | 'assertive';

export type ContentFeedbackRequest = Readonly<{
  kind: ContentFeedbackKind;
}>;

export type ContentFeedbackPresentation = Readonly<{
  kind: ContentFeedbackKind;
  state: StatePresentation;
  ariaRole: ContentFeedbackAriaRole;
  ariaLive: ContentFeedbackAriaLive;
  ariaBusy: boolean;
  retryControl: ControlPresentation | null;
}>;

export const CONTENT_FEEDBACK_ERROR_CODES = Object.freeze([
  'INVALID_CONTENT_FEEDBACK_REQUEST',
  'UNKNOWN_CONTENT_FEEDBACK_FIELD',
  'INVALID_CONTENT_FEEDBACK_KIND',
] as const);

export type ContentFeedbackErrorCode =
  typeof CONTENT_FEEDBACK_ERROR_CODES[number];

export class ContentFeedbackError extends Error {
  readonly code: ContentFeedbackErrorCode;

  constructor(code: ContentFeedbackErrorCode) {
    super(code);
    this.name = 'ContentFeedbackError';
    this.code = code;
  }
}

const states = Object.freeze({
  loading: resolveStatePresentation({
    key: 'state-info',
    surface: 'message',
  }),
  empty: resolveStatePresentation({
    key: 'state-neutral',
    surface: 'message',
  }),
  success: resolveStatePresentation({
    key: 'state-positive',
    surface: 'message',
  }),
  'recoverable-error': resolveStatePresentation({
    key: 'state-warning',
    surface: 'message',
  }),
  'terminal-error': resolveStatePresentation({
    key: 'state-danger',
    surface: 'message',
  }),
});

const retryControl = resolveControlPresentation({
  key: 'action-neutral',
  surface: 'action-button',
});

const registry: Readonly<Record<ContentFeedbackKind, ContentFeedbackPresentation>> =
  Object.freeze({
    loading: Object.freeze({
      kind: 'loading',
      state: states.loading,
      ariaRole: 'status',
      ariaLive: 'polite',
      ariaBusy: true,
      retryControl: null,
    }),
    empty: Object.freeze({
      kind: 'empty',
      state: states.empty,
      ariaRole: 'status',
      ariaLive: 'polite',
      ariaBusy: false,
      retryControl: null,
    }),
    success: Object.freeze({
      kind: 'success',
      state: states.success,
      ariaRole: 'status',
      ariaLive: 'polite',
      ariaBusy: false,
      retryControl: null,
    }),
    'recoverable-error': Object.freeze({
      kind: 'recoverable-error',
      state: states['recoverable-error'],
      ariaRole: 'alert',
      ariaLive: 'assertive',
      ariaBusy: false,
      retryControl,
    }),
    'terminal-error': Object.freeze({
      kind: 'terminal-error',
      state: states['terminal-error'],
      ariaRole: 'alert',
      ariaLive: 'assertive',
      ariaBusy: false,
      retryControl: null,
    }),
  });

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isKind(value: unknown): value is ContentFeedbackKind {
  return (
    typeof value === 'string' &&
    CONTENT_FEEDBACK_KINDS.includes(value as ContentFeedbackKind)
  );
}

export function resolveContentFeedback(
  input: unknown,
): ContentFeedbackPresentation {
  if (!isPlainObject(input)) {
    throw new ContentFeedbackError('INVALID_CONTENT_FEEDBACK_REQUEST');
  }
  for (const field of Object.keys(input)) {
    if (field !== 'kind') {
      throw new ContentFeedbackError('UNKNOWN_CONTENT_FEEDBACK_FIELD');
    }
  }
  if (!isKind(input.kind)) {
    throw new ContentFeedbackError('INVALID_CONTENT_FEEDBACK_KIND');
  }
  return registry[input.kind];
}
