import {
  PRESENTATION_AVAILABILITIES,
  type PresentationAvailability,
} from '../model';

export const CONTROL_FEEDBACK_VISUAL_TREATMENTS = Object.freeze([
  'full',
  'muted',
] as const);

export const CONTROL_FEEDBACK_PROGRESS_VALUES = Object.freeze([
  'none',
  'spinner',
] as const);

export const CONTROL_FEEDBACK_LIVE_VALUES = Object.freeze([
  'off',
  'polite',
] as const);

export type ControlFeedbackVisualTreatment =
  typeof CONTROL_FEEDBACK_VISUAL_TREATMENTS[number];
export type ControlFeedbackProgress =
  typeof CONTROL_FEEDBACK_PROGRESS_VALUES[number];
export type ControlFeedbackLive = typeof CONTROL_FEEDBACK_LIVE_VALUES[number];

export type ControlFeedbackRequest = Readonly<{
  availability: PresentationAvailability;
  preserveToneWhenDisabled: boolean;
}>;

export type ControlFeedbackPresentation = Readonly<{
  availability: PresentationAvailability;
  interactive: boolean;
  nativeDisabled: boolean;
  ariaDisabled: boolean;
  ariaBusy: boolean;
  visualTreatment: ControlFeedbackVisualTreatment;
  progress: ControlFeedbackProgress;
  live: ControlFeedbackLive;
}>;

export const CONTROL_FEEDBACK_ERROR_CODES = Object.freeze([
  'INVALID_CONTROL_FEEDBACK_REQUEST',
  'UNKNOWN_CONTROL_FEEDBACK_FIELD',
  'INVALID_CONTROL_FEEDBACK_AVAILABILITY',
  'INVALID_CONTROL_FEEDBACK_PRESERVATION',
] as const);

export type ControlFeedbackErrorCode =
  typeof CONTROL_FEEDBACK_ERROR_CODES[number];

export class ControlFeedbackError extends Error {
  readonly code: ControlFeedbackErrorCode;

  constructor(code: ControlFeedbackErrorCode) {
    super(code);
    this.name = 'ControlFeedbackError';
    this.code = code;
  }
}

function presentation(
  availability: PresentationAvailability,
  preserveToneWhenDisabled: boolean,
): ControlFeedbackPresentation {
  if (availability === 'enabled') {
    return Object.freeze({
      availability,
      interactive: true,
      nativeDisabled: false,
      ariaDisabled: false,
      ariaBusy: false,
      visualTreatment: 'full',
      progress: 'none',
      live: 'off',
    });
  }

  if (availability === 'pending') {
    return Object.freeze({
      availability,
      interactive: false,
      nativeDisabled: true,
      ariaDisabled: true,
      ariaBusy: true,
      visualTreatment: 'full',
      progress: 'spinner',
      live: 'polite',
    });
  }

  return Object.freeze({
    availability,
    interactive: false,
    nativeDisabled: true,
    ariaDisabled: true,
    ariaBusy: false,
    visualTreatment:
      availability === 'disabled' && !preserveToneWhenDisabled
        ? 'muted'
        : 'full',
    progress: 'none',
    live: 'off',
  });
}

const registry = new Map<string, ControlFeedbackPresentation>();

for (const availability of PRESENTATION_AVAILABILITIES) {
  for (const preserveToneWhenDisabled of [false, true] as const) {
    registry.set(
      `${availability}:${preserveToneWhenDisabled}`,
      presentation(availability, preserveToneWhenDisabled),
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAvailability(value: unknown): value is PresentationAvailability {
  return (
    typeof value === 'string' &&
    PRESENTATION_AVAILABILITIES.includes(value as PresentationAvailability)
  );
}

export function resolveControlFeedback(
  input: unknown,
): ControlFeedbackPresentation {
  if (!isPlainObject(input)) {
    throw new ControlFeedbackError('INVALID_CONTROL_FEEDBACK_REQUEST');
  }

  for (const field of Object.keys(input)) {
    if (
      field !== 'availability' &&
      field !== 'preserveToneWhenDisabled'
    ) {
      throw new ControlFeedbackError('UNKNOWN_CONTROL_FEEDBACK_FIELD');
    }
  }
  if (!isAvailability(input.availability)) {
    throw new ControlFeedbackError(
      'INVALID_CONTROL_FEEDBACK_AVAILABILITY',
    );
  }
  if (typeof input.preserveToneWhenDisabled !== 'boolean') {
    throw new ControlFeedbackError('INVALID_CONTROL_FEEDBACK_PRESERVATION');
  }

  return registry.get(
    `${input.availability}:${input.preserveToneWhenDisabled}`,
  ) as ControlFeedbackPresentation;
}
