import type { PresentationFormFieldDefinition } from '../../foundation/presentation';
import type { Section03NodeId } from '../program';

const requiredMultiline = (
  id: string,
  label: string,
): PresentationFormFieldDefinition => Object.freeze({
  id,
  kind: 'multiline',
  label,
  accessibilityLabel: label,
  required: true,
  minLength: 1,
});

const positiveNumber = (
  id: string,
  label: string,
): PresentationFormFieldDefinition => Object.freeze({
  id,
  kind: 'numeric',
  label,
  accessibilityLabel: label,
  required: true,
  numericRule: 'positive',
});

export const SECTION03_FORM_FIELDS = Object.freeze({
  'S03-M03C': requiredMultiline('comment_finish', 'Комментарий завершения простоя'),
  'S03-D12': requiredMultiline('comment_start', 'Комментарий к критическому простою'),
  'S03-E10': requiredMultiline('shift_finish_reason', 'Причина завершения смены'),
  'S03-E13': positiveNumber('quantity_produced', 'Количество'),
  'S03-AW51': positiveNumber('amount_uzs', 'Сумма'),
  'S03-AW53': requiredMultiline('without_accrual_reason', 'Комментарий'),
  'S03-CF12': positiveNumber('amount_uzs', 'Сумма'),
  'S03-CF13': requiredMultiline('financial_correction_reason', 'Комментарий'),
  'S03-CF24': requiredMultiline('reversal_reason', 'Комментарий'),
  'S03-CP14': Object.freeze({
    id: 'correction_quantity',
    kind: 'numeric',
    label: 'Количество',
    accessibilityLabel: 'Количество',
    required: true,
    numericRule: 'non-negative',
  }),
  'S03-CP15': requiredMultiline('production_correction_reason', 'Комментарий'),
  'S03-R11': Object.freeze({
    id: 'from_date', kind: 'date', label: 'Дата начала',
    accessibilityLabel: 'Дата начала', required: true,
  }),
  'S03-R12': Object.freeze({
    id: 'to_date', kind: 'date', label: 'Дата окончания',
    accessibilityLabel: 'Дата окончания', required: true,
  }),
} satisfies Readonly<Partial<Record<Section03NodeId, PresentationFormFieldDefinition>>>);

export function section03FormFields(
  nodeId: Section03NodeId,
): readonly PresentationFormFieldDefinition[] {
  const field = SECTION03_FORM_FIELDS[nodeId as keyof typeof SECTION03_FORM_FIELDS];
  return field === undefined ? Object.freeze([]) : Object.freeze([field]);
}
