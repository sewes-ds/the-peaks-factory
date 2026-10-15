import {
  formatTimePresentation,
  type TimePresentation,
} from '../time';

export type PresentationGraphTimeRequest =
  | Readonly<{
      role: 'time-only' | 'date-time-multiline';
      timestamp: string;
    }>
  | Readonly<{
      role: 'elapsed-duration';
      totalMinutes: number;
    }>;

export type TextContentInput = Readonly<{
  kind: 'text';
  text: string;
}>;

export type TimeContentInput = Readonly<{
  kind: 'time';
  request: PresentationGraphTimeRequest;
}>;

export type PresentationGraphContentInput =
  | TextContentInput
  | TimeContentInput;

export type ResolvedPresentationGraphContent = Readonly<{
  sourceKind: 'text' | 'time';
  text: string;
  lines: readonly string[];
}>;

export const PRESENTATION_GRAPH_CONTENT_ERROR_CODES = Object.freeze([
  'INVALID_GRAPH_CONTENT',
  'UNKNOWN_GRAPH_CONTENT_FIELD',
  'INVALID_GRAPH_CONTENT_KIND',
  'INVALID_GRAPH_TEXT',
  'INVALID_GRAPH_TIME_REQUEST',
] as const);

export type PresentationGraphContentErrorCode =
  typeof PRESENTATION_GRAPH_CONTENT_ERROR_CODES[number];

export class PresentationGraphContentError extends Error {
  readonly code: PresentationGraphContentErrorCode;
  readonly originalError: unknown;

  constructor(
    code: PresentationGraphContentErrorCode,
    originalError?: unknown,
  ) {
    super(code);
    this.name = 'PresentationGraphContentError';
    this.code = code;
    this.originalError = originalError;
    Object.freeze(this);
  }
}

const ownedContent = new WeakSet<object>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknownFields(
  input: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const field of Object.keys(input)) {
    if (!allowed.includes(field)) {
      throw new PresentationGraphContentError(
        'UNKNOWN_GRAPH_CONTENT_FIELD',
      );
    }
  }
}

function freezeContent(
  sourceKind: 'text' | 'time',
  text: string,
  lines: readonly string[],
): ResolvedPresentationGraphContent {
  const output = Object.freeze({
    sourceKind,
    text,
    lines: Object.freeze([...lines]),
  });
  ownedContent.add(output);
  return output;
}

function linesForTime(
  presentation: TimePresentation,
): readonly string[] {
  return presentation.role === 'date-time-multiline'
    ? presentation.lines
    : [presentation.text];
}

export function resolvePresentationGraphContent(
  input: unknown,
): ResolvedPresentationGraphContent {
  if (!isPlainObject(input)) {
    throw new PresentationGraphContentError('INVALID_GRAPH_CONTENT');
  }
  if (input.kind !== 'text' && input.kind !== 'time') {
    if (typeof input.kind !== 'string') {
      throw new PresentationGraphContentError(
        'INVALID_GRAPH_CONTENT_KIND',
      );
    }
    throw new PresentationGraphContentError('INVALID_GRAPH_CONTENT_KIND');
  }

  if (input.kind === 'text') {
    rejectUnknownFields(input, ['kind', 'text']);
    if (
      typeof input.text !== 'string' ||
      input.text.trim().length === 0
    ) {
      throw new PresentationGraphContentError('INVALID_GRAPH_TEXT');
    }
    return freezeContent('text', input.text, [input.text]);
  }

  rejectUnknownFields(input, ['kind', 'request']);
  try {
    const presentation = formatTimePresentation(input.request);
    return freezeContent(
      'time',
      presentation.text,
      linesForTime(presentation),
    );
  } catch (error) {
    throw new PresentationGraphContentError(
      'INVALID_GRAPH_TIME_REQUEST',
      error,
    );
  }
}

export function isResolvedPresentationGraphContentOwned(
  value: unknown,
): value is ResolvedPresentationGraphContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    ownedContent.has(value)
  );
}
