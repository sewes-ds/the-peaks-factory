import type { ManagerWorkplaceState } from '../contracts';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';
import { P1_WORKPLACE_RESPONSE } from './p1';
import {
  P4A1_EMPTY_RESPONSE,
  P4A1_EMPLOYEES_RESPONSE,
  P4A1_LONG_RESPONSE,
} from './p4a1CorrectionsEntry';

type ExpectedRequest = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  body?: Readonly<Record<string, string>>;
}>;

type ExpectedNavigation = Readonly<{
  target: Section03NodeId;
  event: Section03Context;
}>;

export type Section03P4A2Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-CF12' | 'S03-CF13' | 'S03-CF14';
  context: Section03Context;
  correctionResponse: typeof P4A1_EMPLOYEES_RESPONSE;
  workplaceResponse: ManagerWorkplaceState;
  formValue: string | null;
  formPending: boolean;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedControlKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedNavigations: readonly ExpectedNavigation[];
  expectedBusinessEvent: Section03Context | null;
  expectedActivationRequests: readonly ExpectedRequest[];
  expectedMutationRequests: readonly ExpectedRequest[];
  backTarget: Section03NodeId;
  mutationOutcome: 'none' | 'success' | 'create-failure' | 'malformed-result' | 'approve-failure' | 'pending-duplicate';
  expectProjectionFailure: boolean;
}>;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

export const P4A2_WORKPLACE_AUTHORIZED_RESPONSE = deepFreeze(
  structuredClone(P1_WORKPLACE_RESPONSE) as ManagerWorkplaceState,
);
export const P4A2_WORKPLACE_UNAUTHORIZED_RESPONSE: ManagerWorkplaceState = Object.freeze({
  ...P4A2_WORKPLACE_AUTHORIZED_RESPONSE,
  sections: Object.freeze({
    ...P4A2_WORKPLACE_AUTHORIZED_RESPONSE.sections,
    corrections: Object.freeze({
      ...P4A2_WORKPLACE_AUTHORIZED_RESPONSE.sections.corrections,
      available_actions: Object.freeze([]),
    }),
  }),
});

const accrualBase = Object.freeze({
  employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1',
  correction_mode: 'accrual' as const, salary_correction_type_id: 'TYPE-ACCRUAL',
});
const withholdingBase = Object.freeze({
  employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1',
  correction_mode: 'withholding' as const, salary_correction_type_id: 'TYPE-WITHHOLDING',
});
const accrualAmount = Object.freeze({ ...accrualBase, amount_uzs: '12500.5' });
const withholdingAmount = Object.freeze({ ...withholdingBase, amount_uzs: '12500.5' });
const accrualConfirmation = Object.freeze({
  ...accrualAmount, financial_correction_reason: 'Подтверждённая корректировка',
});
const withholdingConfirmation = Object.freeze({
  ...withholdingAmount, financial_correction_reason: 'Подтверждённая корректировка',
});
const activationGets = Object.freeze([
  Object.freeze({ method: 'GET' as const, path: '/manager/salary-correction-context' }),
  Object.freeze({ method: 'GET' as const, path: '/manager/workplace-state' }),
]);
const accrualBusinessEvent = Object.freeze({
  ...accrualBase, amount_uzs: '12500.5',
  financial_correction_reason: 'Подтверждённая корректировка',
});
const withholdingBusinessEvent = Object.freeze({
  ...withholdingBase, amount_uzs: '-12500.5',
  financial_correction_reason: 'Подтверждённая корректировка',
});
const accrualPosts = Object.freeze([
  Object.freeze({
    method: 'POST' as const,
    path: '/salary-corrections/apply',
    body: Object.freeze({
      employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1',
      salary_correction_type_id: 'TYPE-ACCRUAL', amount: '12500.5',
      reason: 'Подтверждённая корректировка',
    }),
  }),
]);
const withholdingPosts = Object.freeze([
  Object.freeze({
    method: 'POST' as const,
    path: '/salary-corrections/apply',
    body: Object.freeze({
      employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1',
      salary_correction_type_id: 'TYPE-WITHHOLDING', amount: '-12500.5',
      reason: 'Подтверждённая корректировка',
    }),
  }),
]);

const amountItems = Object.freeze(['field-amount_uzs', 'financial-correction-amount-next', 'financial-correction-amount-back']);
const commentItems = Object.freeze(['field-financial_correction_reason', 'financial-correction-comment-next', 'financial-correction-comment-back']);
const confirmItems = Object.freeze(['financial-correction-confirmation', 'financial-correction-create-approve', 'financial-correction-confirm-back']);
const formControls = Object.freeze(['navigation-next', 'navigation-back']);
const formActions = Object.freeze(['navigate0', 'navigateBack0']);
const empty: readonly never[] = Object.freeze([]);

const P4A2_FIXTURES: readonly Section03P4A2Fixture[] = Object.freeze([
  Object.freeze({ fixtureId: 'S03-CF12:empty', nodeId: 'S03-CF12', context: accrualBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '', formPending: false, orderedItemIds: amountItems, visibleText: Object.freeze(['Финансовая корректировка', 'Сумма', 'Далее', 'Назад']), absentText: Object.freeze(['EMP-1', 'TYPE-ACCRUAL']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF12:malformed', nodeId: 'S03-CF12', context: accrualBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '12..5', formPending: false, orderedItemIds: amountItems, visibleText: Object.freeze(['Сумма', '12..5', 'Далее', 'Назад']), absentText: Object.freeze(['S03-CF12']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF12:zero', nodeId: 'S03-CF12', context: accrualBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '0', formPending: false, orderedItemIds: amountItems, visibleText: Object.freeze(['Сумма', '0', 'Далее', 'Назад']), absentText: Object.freeze(['TYPE-ACCRUAL']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF12:negative', nodeId: 'S03-CF12', context: withholdingBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '-5', formPending: false, orderedItemIds: amountItems, visibleText: Object.freeze(['Сумма', '-5', 'Далее', 'Назад']), absentText: Object.freeze(['TYPE-WITHHOLDING']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF12:valid-integer-accrual', nodeId: 'S03-CF12', context: accrualBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '12500', formPending: false, orderedItemIds: amountItems, visibleText: Object.freeze(['Финансовая корректировка', 'Сумма', '12500', 'Далее', 'Назад']), absentText: Object.freeze(['EMP-1', 'TYPE-ACCRUAL']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CF13', event: Object.freeze({ ...accrualBase, amount_uzs: '12500' }) })]), expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF12:valid-comma-withholding', nodeId: 'S03-CF12', context: withholdingBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '12500,50', formPending: false, orderedItemIds: amountItems, visibleText: Object.freeze(['Сумма', '12500,50', 'Далее', 'Назад']), absentText: Object.freeze(['-12500.5', 'TYPE-WITHHOLDING']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CF13', event: withholdingAmount })]), expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF12:long-valid-amount', nodeId: 'S03-CF12', context: accrualBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '12345678901234567890.12345', formPending: false, orderedItemIds: amountItems, visibleText: Object.freeze(['Сумма', '12345678901234567890.12345', 'Далее']), absentText: Object.freeze(['undefined']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CF13', event: Object.freeze({ ...accrualBase, amount_uzs: '12345678901234567890.12345' }) })]), expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF12:pending', nodeId: 'S03-CF12', context: accrualBase, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '12500.5', formPending: true, orderedItemIds: amountItems, visibleText: Object.freeze(['Сумма', '12500.5', 'Далее', 'Назад']), absentText: Object.freeze(['S03-CF13']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF11', mutationOutcome: 'none', expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-CF13:empty', nodeId: 'S03-CF13', context: accrualAmount, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '', formPending: false, orderedItemIds: commentItems, visibleText: Object.freeze(['Комментарий', 'Далее', 'Назад']), absentText: Object.freeze(['EMP-1', '12500.5']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF12', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF13:whitespace-only', nodeId: 'S03-CF13', context: accrualAmount, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '   ', formPending: false, orderedItemIds: commentItems, visibleText: Object.freeze(['Комментарий', 'Далее', 'Назад']), absentText: Object.freeze(['S03-CF14']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF12', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF13:valid-trimmed-comment', nodeId: 'S03-CF13', context: accrualAmount, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '  Подтверждённая корректировка  ', formPending: false, orderedItemIds: commentItems, visibleText: Object.freeze(['Комментарий', 'Подтверждённая корректировка', 'Далее', 'Назад']), absentText: Object.freeze(['EMP-1', 'TYPE-ACCRUAL']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CF14', event: accrualConfirmation })]), expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF12', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF13:valid-multiline-comment', nodeId: 'S03-CF13', context: withholdingAmount, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: '  Первая строка\nВторая строка  ', formPending: false, orderedItemIds: commentItems, visibleText: Object.freeze(['Комментарий', 'Первая строка', 'Вторая строка', 'Далее']), absentText: Object.freeze(['TYPE-WITHHOLDING']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CF14', event: Object.freeze({ ...withholdingAmount, financial_correction_reason: 'Первая строка\nВторая строка' }) })]), expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF12', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF13:long-comment', nodeId: 'S03-CF13', context: accrualAmount, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: 'Очень длинный комментарий финансовой корректировки, который переносится на несколько строк и сохраняется полностью без визуальной обрезки.', formPending: false, orderedItemIds: commentItems, visibleText: Object.freeze(['Очень длинный комментарий финансовой корректировки', 'Далее', 'Назад']), absentText: Object.freeze(['undefined']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CF14', event: Object.freeze({ ...accrualAmount, financial_correction_reason: 'Очень длинный комментарий финансовой корректировки, который переносится на несколько строк и сохраняется полностью без визуальной обрезки.' }) })]), expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF12', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF13:pending', nodeId: 'S03-CF13', context: accrualAmount, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: 'Подтверждённая корректировка', formPending: true, orderedItemIds: commentItems, visibleText: Object.freeze(['Комментарий', 'Подтверждённая корректировка', 'Далее', 'Назад']), absentText: Object.freeze(['S03-CF14']), expectedStateKeys: empty, expectedControlKeys: formControls, expectedActionIds: formActions, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF12', mutationOutcome: 'none', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF13:invalid-incoming-amount', nodeId: 'S03-CF13', context: Object.freeze({ ...accrualBase, amount_uzs: '-10' }), correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: 'Комментарий', formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF12', mutationOutcome: 'none', expectProjectionFailure: true }),

  Object.freeze({ fixtureId: 'S03-CF14:accrual-authorized', nodeId: 'S03-CF14', context: accrualConfirmation, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: confirmItems, visibleText: Object.freeze(['Подтвердите корректировку:', 'Сотрудник', 'Анна Ким', 'Начисление', 'Сумма', '12501', 'Комментарий', 'Подтверждённая корректировка', 'Начислить', 'Назад']), absentText: Object.freeze(['12500.5', 'сум', 'EMP-1', 'SHIFT-1', 'TYPE-ACCRUAL', 'S03-CF14']), expectedStateKeys: Object.freeze(['state-positive']), expectedControlKeys: Object.freeze(['action-positive', 'navigation-back']), expectedActionIds: Object.freeze(['CREATE_APPROVE_SALARY_CORRECTION', 'navigateBack0']), expectedNavigations: empty, expectedBusinessEvent: accrualBusinessEvent, expectedActivationRequests: activationGets, expectedMutationRequests: accrualPosts, backTarget: 'S03-CF13', mutationOutcome: 'success', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF14:withholding-authorized', nodeId: 'S03-CF14', context: withholdingConfirmation, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: confirmItems, visibleText: Object.freeze(['Подтвердите корректировку:', 'Анна Ким', 'Удержание', '-12501', 'Подтверждённая корректировка', 'Удержать', 'Назад']), absentText: Object.freeze(['-12500.5', 'Начисление', 'TYPE-WITHHOLDING', 'S03-CF14']), expectedStateKeys: Object.freeze(['state-danger']), expectedControlKeys: Object.freeze(['action-danger', 'navigation-back']), expectedActionIds: Object.freeze(['CREATE_APPROVE_SALARY_CORRECTION', 'navigateBack0']), expectedNavigations: empty, expectedBusinessEvent: withholdingBusinessEvent, expectedActivationRequests: activationGets, expectedMutationRequests: withholdingPosts, backTarget: 'S03-CF13', mutationOutcome: 'success', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF14:pending-duplicate', nodeId: 'S03-CF14', context: accrualConfirmation, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: confirmItems, visibleText: Object.freeze(['Анна Ким', 'Начисление', '12501', 'Начислить']), absentText: Object.freeze(['12500.5', 'S03-CF14']), expectedStateKeys: Object.freeze(['state-positive']), expectedControlKeys: Object.freeze(['action-positive', 'navigation-back']), expectedActionIds: Object.freeze(['CREATE_APPROVE_SALARY_CORRECTION', 'navigateBack0']), expectedNavigations: empty, expectedBusinessEvent: accrualBusinessEvent, expectedActivationRequests: activationGets, expectedMutationRequests: accrualPosts, backTarget: 'S03-CF13', mutationOutcome: 'pending-duplicate', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF14:create-failure', nodeId: 'S03-CF14', context: accrualConfirmation, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: confirmItems, visibleText: Object.freeze(['Подтвердите корректировку:', 'Анна Ким', 'Начислить']), absentText: Object.freeze(['EMP-1']), expectedStateKeys: Object.freeze(['state-positive']), expectedControlKeys: Object.freeze(['action-positive', 'navigation-back']), expectedActionIds: Object.freeze(['CREATE_APPROVE_SALARY_CORRECTION', 'navigateBack0']), expectedNavigations: empty, expectedBusinessEvent: accrualBusinessEvent, expectedActivationRequests: activationGets, expectedMutationRequests: Object.freeze([accrualPosts[0]!]), backTarget: 'S03-CF13', mutationOutcome: 'create-failure', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF14:malformed-create-result', nodeId: 'S03-CF14', context: accrualConfirmation, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: confirmItems, visibleText: Object.freeze(['Анна Ким', 'Начисление', 'Начислить']), absentText: Object.freeze(['RESULT-1']), expectedStateKeys: Object.freeze(['state-positive']), expectedControlKeys: Object.freeze(['action-positive', 'navigation-back']), expectedActionIds: Object.freeze(['CREATE_APPROVE_SALARY_CORRECTION', 'navigateBack0']), expectedNavigations: empty, expectedBusinessEvent: accrualBusinessEvent, expectedActivationRequests: activationGets, expectedMutationRequests: Object.freeze([accrualPosts[0]!]), backTarget: 'S03-CF13', mutationOutcome: 'malformed-result', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF14:approve-failure', nodeId: 'S03-CF14', context: withholdingConfirmation, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: confirmItems, visibleText: Object.freeze(['Анна Ким', 'Удержание', '-12501', 'Удержать']), absentText: Object.freeze(['-12500.5', 'TYPE-WITHHOLDING']), expectedStateKeys: Object.freeze(['state-danger']), expectedControlKeys: Object.freeze(['action-danger', 'navigation-back']), expectedActionIds: Object.freeze(['CREATE_APPROVE_SALARY_CORRECTION', 'navigateBack0']), expectedNavigations: empty, expectedBusinessEvent: withholdingBusinessEvent, expectedActivationRequests: activationGets, expectedMutationRequests: withholdingPosts, backTarget: 'S03-CF13', mutationOutcome: 'approve-failure', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF14:long-content', nodeId: 'S03-CF14', context: Object.freeze({ employee_id: 'EMP-LONG', employee_shift_id: 'SHIFT-LONG', correction_mode: 'accrual', salary_correction_type_id: 'TYPE-ACCRUAL', amount_uzs: '12345678901234567890.12345', financial_correction_reason: 'Очень длинный многострочный комментарий финансовой корректировки.\nВторая строка сохраняется полностью и расширяет карточку без обрезания.' }), correctionResponse: P4A1_LONG_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: confirmItems, visibleText: Object.freeze(['Очень длинное имя сотрудника', '12345678901234567890', 'Вторая строка сохраняется полностью', 'Начислить', 'Назад']), absentText: Object.freeze(['12345678901234567890.12345', 'EMP-LONG', 'TYPE-ACCRUAL', 'undefined']), expectedStateKeys: Object.freeze(['state-positive']), expectedControlKeys: Object.freeze(['action-positive', 'navigation-back']), expectedActionIds: Object.freeze(['CREATE_APPROVE_SALARY_CORRECTION', 'navigateBack0']), expectedNavigations: empty, expectedBusinessEvent: Object.freeze({ employee_id: 'EMP-LONG', employee_shift_id: 'SHIFT-LONG', salary_correction_type_id: 'TYPE-ACCRUAL', correction_mode: 'accrual', amount_uzs: '12345678901234567890.12345', financial_correction_reason: 'Очень длинный многострочный комментарий финансовой корректировки.\nВторая строка сохраняется полностью и расширяет карточку без обрезания.' }), expectedActivationRequests: activationGets, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-CF14:fresh-employee-missing', nodeId: 'S03-CF14', context: accrualConfirmation, correctionResponse: P4A1_EMPTY_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: activationGets, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-CF14:fresh-shift-mismatch', nodeId: 'S03-CF14', context: Object.freeze({ ...accrualConfirmation, employee_shift_id: 'SHIFT-STALE' }), correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: activationGets, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-CF14:stale-accrual-type', nodeId: 'S03-CF14', context: Object.freeze({ ...accrualConfirmation, salary_correction_type_id: 'TYPE-STALE' }), correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: activationGets, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-CF14:stale-withholding-type', nodeId: 'S03-CF14', context: Object.freeze({ ...withholdingConfirmation, salary_correction_type_id: 'TYPE-STALE' }), correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: activationGets, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-CF14:missing-open-corrections', nodeId: 'S03-CF14', context: accrualConfirmation, correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_UNAUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: activationGets, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-CF14:invalid-incoming-amount', nodeId: 'S03-CF14', context: Object.freeze({ ...accrualConfirmation, amount_uzs: '-12500.5' }), correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: activationGets, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-CF14:invalid-incoming-reason', nodeId: 'S03-CF14', context: Object.freeze({ ...accrualAmount, financial_correction_reason: '   ' }), correctionResponse: P4A1_EMPLOYEES_RESPONSE, workplaceResponse: P4A2_WORKPLACE_AUTHORIZED_RESPONSE, formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedNavigations: empty, expectedBusinessEvent: null, expectedActivationRequests: empty, expectedMutationRequests: empty, backTarget: 'S03-CF13', mutationOutcome: 'none', expectProjectionFailure: true }),
]);

export const SECTION03_P4A2_FIXTURES: readonly Section03P4A2Fixture[] = deepFreeze(P4A2_FIXTURES);

export const SECTION03_P4A2_FIXTURE_IDS = Object.freeze(
  SECTION03_P4A2_FIXTURES.map((fixture) => fixture.fixtureId),
);
