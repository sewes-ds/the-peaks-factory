import { definePresentationFormField, type PresentationFormFieldDefinition } from '../foundation/presentation';
import type { Section02NodeId } from './ids';

const fields = Object.freeze({
  quantity_produced: definePresentationFormField({
    id: 'quantity_produced', kind: 'numeric', label: 'Количество произведено', accessibilityLabel: 'Количество произведено',
    placeholder: '0', required: true, numericRule: 'positive',
  }),
  comment: definePresentationFormField({
    id: 'comment', kind: 'multiline', label: 'Комментарий', accessibilityLabel: 'Комментарий к критическому простою',
    placeholder: 'Опишите причину простоя', required: true, minLength: 1, maxLength: 500,
  }),
});

export function section02FormFields(nodeId: Section02NodeId): readonly PresentationFormFieldDefinition[] {
  if (nodeId === 'S02-N08') return Object.freeze([fields.quantity_produced]);
  if (nodeId === 'S02-N26_keyboard') return Object.freeze([fields.comment]);
  return Object.freeze([]);
}
