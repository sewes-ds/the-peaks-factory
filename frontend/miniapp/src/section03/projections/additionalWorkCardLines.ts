import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import { text } from './common';

export function additionalWorkEntityLines(input: Readonly<{
  idPrefix: string;
  employeeFullName: string;
  additionalWorkName: string;
}>): readonly PresentationGraphCardLineInput[] {
  return Object.freeze([
    Object.freeze({
      id: `${input.idPrefix}-employee`,
      label: text('Сотрудник'),
      value: text(input.employeeFullName),
    }),
    Object.freeze({
      id: `${input.idPrefix}-type`,
      label: text('Вид работы'),
      value: text(input.additionalWorkName),
    }),
  ]);
}
