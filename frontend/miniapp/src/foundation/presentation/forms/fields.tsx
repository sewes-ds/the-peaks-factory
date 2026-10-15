import type { ChangeEvent, ReactNode } from 'react';

import type { PresentationFormFieldKind, PresentationFormFieldPresentation } from './model';

type FieldProps<TKind extends PresentationFormFieldKind> = Readonly<{
  field: PresentationFormFieldPresentation & Readonly<{ definition: Readonly<{ kind: TKind }> }>;
  onValueChange: (value: string) => void;
}>;

function shared(field: PresentationFormFieldPresentation) {
  return {
    'aria-busy': field.pending,
    'aria-invalid': !field.validation.valid,
    'aria-label': field.definition.accessibilityLabel,
    disabled: field.disabled,
    id: field.definition.id,
    placeholder: field.definition.placeholder,
    required: field.definition.required,
    value: field.value,
  } as const;
}

function change(onValueChange: (value: string) => void) {
  return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValueChange(event.currentTarget.value);
}

function frame(field: PresentationFormFieldPresentation, control: ReactNode) {
  return (
    <label className="peaks-presentation-form-field" htmlFor={field.definition.id}>
      <span className="peaks-presentation-form-field__label">{field.definition.label}</span>
      {control}
    </label>
  );
}

export function PresentationTextField({ field, onValueChange }: FieldProps<'text'>) {
  return frame(field, <input {...shared(field)} className="peaks-presentation-form-field__control" type="text" onChange={change(onValueChange)} />);
}

export function PresentationMultilineField({ field, onValueChange }: FieldProps<'multiline'>) {
  return frame(field, <textarea {...shared(field)} className="peaks-presentation-form-field__control peaks-presentation-form-field__control--multiline" onChange={change(onValueChange)} />);
}

export function PresentationNumericField({ field, onValueChange }: FieldProps<'numeric'>) {
  return frame(field, <input {...shared(field)} className="peaks-presentation-form-field__control" inputMode="decimal" type="text" onChange={change(onValueChange)} />);
}

export function PresentationDateField({ field, onValueChange }: FieldProps<'date'>) {
  return frame(field, <input {...shared(field)} className="peaks-presentation-form-field__control" type="date" onChange={change(onValueChange)} />);
}

export type PresentationFieldMessageProps = Readonly<{
  kind: 'feedback' | 'error';
  message: ReactNode;
}>;

export function PresentationFieldMessage({ kind, message }: PresentationFieldMessageProps) {
  return <div aria-live="polite" className="peaks-presentation-form-field__message" data-field-message-kind={kind}>{message}</div>;
}

export function PresentationFormField(input: Readonly<{
  field: PresentationFormFieldPresentation;
  onValueChange: (value: string) => void;
}>) {
  if (input.field.definition.kind === 'text') return <PresentationTextField field={input.field as FieldProps<'text'>['field']} onValueChange={input.onValueChange} />;
  if (input.field.definition.kind === 'multiline') return <PresentationMultilineField field={input.field as FieldProps<'multiline'>['field']} onValueChange={input.onValueChange} />;
  if (input.field.definition.kind === 'numeric') return <PresentationNumericField field={input.field as FieldProps<'numeric'>['field']} onValueChange={input.onValueChange} />;
  return <PresentationDateField field={input.field as FieldProps<'date'>['field']} onValueChange={input.onValueChange} />;
}
