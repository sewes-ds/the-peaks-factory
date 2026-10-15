export const PRESENTATION_FORM_FIELD_KINDS = Object.freeze([
  'text',
  'multiline',
  'numeric',
  'date',
] as const);

export type PresentationFormFieldKind = typeof PRESENTATION_FORM_FIELD_KINDS[number];
export type PresentationNumericRule = 'finite-decimal' | 'non-negative' | 'positive';

export type PresentationFormFieldDefinition = Readonly<{
  id: string;
  kind: PresentationFormFieldKind;
  label: string;
  accessibilityLabel: string;
  placeholder?: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  numericRule?: PresentationNumericRule;
}>;

export type PresentationFieldValidationCode =
  | 'REQUIRED'
  | 'MIN_LENGTH'
  | 'MAX_LENGTH'
  | 'INVALID_DECIMAL'
  | 'NEGATIVE_FORBIDDEN'
  | 'POSITIVE_REQUIRED'
  | 'INVALID_DATE';

export type PresentationFieldValidation = Readonly<{
  valid: boolean;
  code: PresentationFieldValidationCode | null;
  normalizedValue: string;
}>;

export type PresentationFormFieldPresentation = Readonly<{
  definition: PresentationFormFieldDefinition;
  value: string;
  validation: PresentationFieldValidation;
  disabled: boolean;
  pending: boolean;
}>;

export const PRESENTATION_FORM_ERROR_CODES = Object.freeze([
  'INVALID_FIELD_DEFINITION',
  'DUPLICATE_FIELD_ID',
  'UNKNOWN_FIELD_ID',
  'INVALID_DRAFT_VALUE',
  'INVALID_DRAFT_CONTROLLER',
  'FORM_INVALID',
  'FORM_PENDING',
] as const);

export type PresentationFormErrorCode = typeof PRESENTATION_FORM_ERROR_CODES[number];

export class PresentationFormError extends Error {
  readonly code: PresentationFormErrorCode;
  readonly fieldId: string | null;

  constructor(code: PresentationFormErrorCode, fieldId?: string) {
    super(code);
    this.name = 'PresentationFormError';
    this.code = code;
    this.fieldId = fieldId ?? null;
    Object.freeze(this);
  }
}
