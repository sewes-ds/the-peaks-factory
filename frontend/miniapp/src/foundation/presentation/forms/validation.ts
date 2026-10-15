import {
  PRESENTATION_FORM_FIELD_KINDS,
  PresentationFormError,
  type PresentationFieldValidation,
  type PresentationFormFieldDefinition,
} from './model';

function invalid(code: PresentationFieldValidation['code'], value: string): PresentationFieldValidation {
  return Object.freeze({ valid: false, code, normalizedValue: value });
}

function valid(value: string): PresentationFieldValidation {
  return Object.freeze({ valid: true, code: null, normalizedValue: value });
}

function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

const FIELD_DEFINITION_KEYS = Object.freeze([
  'id',
  'kind',
  'label',
  'accessibilityLabel',
  'placeholder',
  'required',
  'minLength',
  'maxLength',
  'numericRule',
] as const);

export function definePresentationFormField(input: PresentationFormFieldDefinition): PresentationFormFieldDefinition {
  if (
    typeof input !== 'object' || input === null ||
    Object.keys(input).some((key) => !FIELD_DEFINITION_KEYS.includes(key as typeof FIELD_DEFINITION_KEYS[number])) ||
    typeof input.id !== 'string' || input.id.trim().length === 0 ||
    typeof input.label !== 'string' || input.label.trim().length === 0 ||
    typeof input.accessibilityLabel !== 'string' || input.accessibilityLabel.trim().length === 0 ||
    (input.placeholder !== undefined && typeof input.placeholder !== 'string') ||
    !PRESENTATION_FORM_FIELD_KINDS.includes(input.kind) ||
    typeof input.required !== 'boolean' ||
    (input.minLength !== undefined && !natural(input.minLength)) ||
    (input.maxLength !== undefined && !natural(input.maxLength)) ||
    (input.minLength !== undefined && input.maxLength !== undefined && input.minLength > input.maxLength) ||
    (input.kind === 'numeric' && !['finite-decimal', 'non-negative', 'positive'].includes(input.numericRule ?? '')) ||
    (input.kind !== 'numeric' && input.numericRule !== undefined)
  ) {
    throw new PresentationFormError('INVALID_FIELD_DEFINITION');
  }
  return Object.freeze({ ...input });
}

export function normalizePresentationNumeric(value: string): string {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return value;
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction] = unsigned.split('.');
  const normalizedFraction = fraction?.replace(/0+$/, '');
  const normalized = normalizedFraction ? `${whole}.${normalizedFraction}` : whole;
  return negative && normalized !== '0' ? `-${normalized}` : normalized;
}

function isExactDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validatePresentationFormValue(
  definition: PresentationFormFieldDefinition,
  value: string,
): PresentationFieldValidation {
  if (typeof value !== 'string') throw new PresentationFormError('INVALID_DRAFT_VALUE', definition.id);
  const trimmed = definition.kind === 'text' || definition.kind === 'multiline' ? value.trim() : value;
  if (definition.required && trimmed.length === 0) return invalid('REQUIRED', value);
  if (trimmed.length === 0) return valid('');
  if (definition.minLength !== undefined && trimmed.length < definition.minLength) return invalid('MIN_LENGTH', value);
  if (definition.maxLength !== undefined && trimmed.length > definition.maxLength) return invalid('MAX_LENGTH', value);
  if (definition.kind === 'numeric') {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return invalid('INVALID_DECIMAL', value);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return invalid('INVALID_DECIMAL', value);
    if (definition.numericRule === 'non-negative' && numeric < 0) return invalid('NEGATIVE_FORBIDDEN', value);
    if (definition.numericRule === 'positive' && numeric <= 0) return invalid('POSITIVE_REQUIRED', value);
    return valid(normalizePresentationNumeric(value));
  }
  if (definition.kind === 'date' && !isExactDate(value)) return invalid('INVALID_DATE', value);
  return valid(definition.kind === 'date' ? value : trimmed);
}

export function resolvePresentationFormField(
  definition: PresentationFormFieldDefinition,
  value: string,
  options: Readonly<{ disabled: boolean; pending: boolean }>,
): import('./model').PresentationFormFieldPresentation {
  return Object.freeze({
    definition,
    value,
    validation: validatePresentationFormValue(definition, value),
    disabled: options.disabled || options.pending,
    pending: options.pending,
  });
}
