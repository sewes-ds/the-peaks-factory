import { ApiError } from './db/errors.js';

export const ADDITIONAL_WORK_ASSIGNMENT_BLOCKED_CODES = Object.freeze([
  'additional_work_assignment_already_exists',
  'additional_work_target_not_available',
  'additional_work_type_not_available',
  'additional_work_assignment_forbidden',
  'additional_work_assignment_conflict'
] as const);

export type AdditionalWorkAssignmentBlockedCode =
  typeof ADDITIONAL_WORK_ASSIGNMENT_BLOCKED_CODES[number];

export const ADDITIONAL_WORK_ASSIGNMENT_CONTRACTS: Readonly<Record<
  AdditionalWorkAssignmentBlockedCode,
  Readonly<{ statusCode: 403 | 409; message: string }>
>> = Object.freeze({
  additional_work_assignment_already_exists: Object.freeze({
    statusCode: 409,
    message: 'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.'
  }),
  additional_work_target_not_available: Object.freeze({
    statusCode: 409,
    message: 'Сотрудник недоступен для назначения доп. работы. Обновите список.'
  }),
  additional_work_type_not_available: Object.freeze({
    statusCode: 409,
    message: 'Этот вид доп. работы больше недоступен. Обновите список.'
  }),
  additional_work_assignment_forbidden: Object.freeze({
    statusCode: 403,
    message: 'Недостаточно прав для назначения доп. работы.'
  }),
  additional_work_assignment_conflict: Object.freeze({
    statusCode: 409,
    message: 'Не удалось назначить доп. работу из-за изменения данных. Обновите список и повторите.'
  })
});

export function additionalWorkAssignmentApiError(
  code: AdditionalWorkAssignmentBlockedCode
): ApiError {
  const contract = ADDITIONAL_WORK_ASSIGNMENT_CONTRACTS[code];
  return new ApiError(contract.statusCode, code, contract.message);
}
