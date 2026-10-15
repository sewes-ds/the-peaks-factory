import { useCallback, useEffect, useMemo, useState } from 'react';

import { PresentationFormError, type PresentationFormFieldDefinition, type PresentationFormFieldPresentation } from './model';
import { definePresentationFormField, resolvePresentationFormField } from './validation';

export type PresentationFormDraftController = Readonly<{
  activationKey: string;
  fieldIds: readonly string[];
  field: (fieldId: string) => PresentationFormFieldPresentation;
  setValue: (fieldId: string, value: string) => void;
  reset: () => void;
  valid: boolean;
  commit: () => Readonly<Record<string, string>>;
}>;

const owned = new WeakSet<object>();

export function isPresentationFormDraftControllerOwned(value: unknown): value is PresentationFormDraftController {
  return typeof value === 'object' && value !== null && owned.has(value);
}

function initialValues(fields: readonly PresentationFormFieldDefinition[], initial: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.id, initial[field.id] ?? '']));
}

export function usePresentationFormDraftController(input: Readonly<{
  activationKey: string;
  fields: readonly PresentationFormFieldDefinition[];
  initialValues?: Readonly<Record<string, string>>;
  disabled?: boolean;
  pending?: boolean;
}>): PresentationFormDraftController {
  const fieldSignature = JSON.stringify(input.fields);
  const fields = useMemo(
    () => Object.freeze(input.fields.map(definePresentationFormField)),
    [fieldSignature],
  );
  const definitions = useMemo(() => {
    const ids = new Set<string>();
    for (const field of fields) {
      if (ids.has(field.id)) throw new PresentationFormError('DUPLICATE_FIELD_ID', field.id);
      ids.add(field.id);
    }
    return new Map(fields.map((field) => [field.id, field]));
  }, [fields]);
  const initialSignature = JSON.stringify(input.initialValues ?? {});
  const initial = useMemo(
    () => Object.freeze({ ...(input.initialValues ?? {}) }),
    [initialSignature],
  );
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields, initial));
  const reset = useCallback(() => setValues(initialValues(fields, initial)), [fields, initial]);
  useEffect(reset, [input.activationKey, reset]);
  const setValue = useCallback((fieldId: string, value: string) => {
    if (!definitions.has(fieldId)) throw new PresentationFormError('UNKNOWN_FIELD_ID', fieldId);
    if (typeof value !== 'string') throw new PresentationFormError('INVALID_DRAFT_VALUE', fieldId);
    setValues((current) => ({ ...current, [fieldId]: value }));
  }, [definitions]);
  const presentations = new Map([...definitions].map(([id, definition]) => [
    id,
    resolvePresentationFormField(definition, values[id] ?? '', { disabled: input.disabled ?? false, pending: input.pending ?? false }),
  ]));
  const valid = [...presentations.values()].every((field) => field.validation.valid);
  const controller: PresentationFormDraftController = Object.freeze({
    activationKey: input.activationKey,
    fieldIds: Object.freeze([...definitions.keys()]),
    field: (fieldId: string) => {
      const presentation = presentations.get(fieldId);
      if (presentation === undefined) throw new PresentationFormError('UNKNOWN_FIELD_ID', fieldId);
      return presentation;
    },
    setValue,
    reset,
    valid,
    commit: () => {
      if (input.pending === true) throw new PresentationFormError('FORM_PENDING');
      if (!valid) throw new PresentationFormError('FORM_INVALID');
      return Object.freeze(Object.fromEntries([...presentations].map(([id, field]) => [id, field.validation.normalizedValue])));
    },
  });
  owned.add(controller);
  return controller;
}
