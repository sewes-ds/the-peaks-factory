import type { ManagerSalaryCorrectionContextResponse } from '../contracts';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';

type Request = Readonly<{ method: 'GET'; path: '/manager/salary-correction-context' }>;
type Navigation = Readonly<{ target: string; event: Readonly<Record<string, string>> }>;

export type Section03P4A1Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-C00' | 'S03-CF01' | 'S03-CF10' | 'S03-CF11';
  context: Section03Context;
  apiResponse: ManagerSalaryCorrectionContextResponse | null;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedControlKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedNavigations: readonly Navigation[];
  expectedRequests: readonly Request[];
  backTarget: Section03NodeId;
  expectProjectionFailure: boolean;
}>;

const get = Object.freeze({ method: 'GET' as const, path: '/manager/salary-correction-context' as const });
const first = Object.freeze({
  employee_id: 'EMP-1', employee_full_name: 'Анна Ким', employee_shift_id: 'SHIFT-1',
  shift_started_at: '2026-08-02T08:00:00+05:00', shift_finished_at: null,
});
const second = Object.freeze({
  employee_id: 'EMP-2', employee_full_name: 'Борис Ли', employee_shift_id: 'SHIFT-2',
  shift_started_at: '2026-08-02T07:45:00+05:00', shift_finished_at: null,
});
const finished = Object.freeze({
  employee_id: 'EMP-3', employee_full_name: 'Вера Юн', employee_shift_id: 'SHIFT-3',
  shift_started_at: '2026-08-02T06:00:00+05:00', shift_finished_at: '2026-08-02T14:00:00+05:00',
});
const long = Object.freeze({
  employee_id: 'EMP-LONG',
  employee_full_name: 'Очень длинное имя сотрудника для проверки переноса строки и автоматического роста элемента без обрезания',
  employee_shift_id: 'SHIFT-LONG', shift_started_at: '2026-08-02T05:30:00+05:00', shift_finished_at: null,
});

function response(
  employees: ManagerSalaryCorrectionContextResponse['employees_with_today_shift'],
  accrualId: string | number = 'TYPE-ACCRUAL',
  withholdingId: string | number = 'TYPE-WITHHOLDING',
): ManagerSalaryCorrectionContextResponse {
  return Object.freeze({
    section: 'S03', screen: 'S03-CF10', employees_with_today_shift: Object.freeze([...employees]),
    default_accrual_salary_correction_type_id: String(accrualId),
    default_withholding_salary_correction_type_id: String(withholdingId),
    available_actions: Object.freeze(['BACK'] as const),
  });
}

export const P4A1_EMPLOYEES_RESPONSE = response([first, second]);
export const P4A1_EMPTY_RESPONSE = response([]);
export const P4A1_BACKEND_ORDER_RESPONSE = response([second, first]);
export const P4A1_FINISHED_RESPONSE = response([finished]);
export const P4A1_LONG_RESPONSE = response([long]);

const firstContext = Object.freeze({ employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1' });
const secondContext = Object.freeze({ employee_id: 'EMP-2', employee_shift_id: 'SHIFT-2' });
const finishedContext = Object.freeze({ employee_id: 'EMP-3', employee_shift_id: 'SHIFT-3' });
const longContext = Object.freeze({ employee_id: 'EMP-LONG', employee_shift_id: 'SHIFT-LONG' });

export const SECTION03_P4A1_FIXTURES = Object.freeze([
  Object.freeze({ fixtureId: 'S03-C00:menu', nodeId: 'S03-C00', context: Object.freeze({}), apiResponse: null, orderedItemIds: Object.freeze(['corrections-finance', 'corrections-production', 'corrections-back']), visibleText: Object.freeze(['Корректировки', 'Финансы', 'Производство', 'Назад']), absentText: Object.freeze(['S03-C00', 'Сценарий']), expectedStateKeys: Object.freeze([]), expectedControlKeys: Object.freeze(['navigation-open', 'navigation-open', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate1', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF01', event: {} }, { target: 'S03-CP00', event: {} }]), expectedRequests: Object.freeze([]), backTarget: 'S03-N01', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF01:menu', nodeId: 'S03-CF01', context: Object.freeze({}), apiResponse: null, orderedItemIds: Object.freeze(['financial-correction-employee', 'financial-correction-storno', 'financial-correction-back']), visibleText: Object.freeze(['Финансовая корректировка', 'Корректировка по сотруднику', 'Сторно по операции', 'Назад']), absentText: Object.freeze(['S03-CF01', 'Сценарий']), expectedStateKeys: Object.freeze([]), expectedControlKeys: Object.freeze(['navigation-open', 'navigation-open', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate1', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF10', event: {} }, { target: 'S03-CF20', event: {} }]), expectedRequests: Object.freeze([]), backTarget: 'S03-C00', expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-CF10:employees', nodeId: 'S03-CF10', context: Object.freeze({}), apiResponse: P4A1_EMPLOYEES_RESPONSE, orderedItemIds: Object.freeze(['cf-emp-EMP-1', 'cf-emp-EMP-2', 'financial-correction-employee-back']), visibleText: Object.freeze(['Финансовая корректировка', 'Анна Ким', 'Борис Ли', 'Назад']), absentText: Object.freeze(['SHIFT-1', 'TYPE-ACCRUAL', 'S03-CF10']), expectedStateKeys: Object.freeze(['state-info', 'state-info']), expectedControlKeys: Object.freeze(['navigation-open', 'navigation-open', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF11', event: firstContext }, { target: 'S03-CF11', event: secondContext }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF01', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF10:empty', nodeId: 'S03-CF10', context: Object.freeze({}), apiResponse: P4A1_EMPTY_RESPONSE, orderedItemIds: Object.freeze(['financial-correction-employee-empty', 'financial-correction-employee-back']), visibleText: Object.freeze(['Финансовая корректировка', 'Нет сотрудников со сменой за текущий день.', 'Назад']), absentText: Object.freeze(['Начислить', 'S03-CF10']), expectedStateKeys: Object.freeze(['state-info']), expectedControlKeys: Object.freeze(['navigation-back']), expectedActionIds: Object.freeze(['navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF01', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF10:backend-order', nodeId: 'S03-CF10', context: Object.freeze({}), apiResponse: P4A1_BACKEND_ORDER_RESPONSE, orderedItemIds: Object.freeze(['cf-emp-EMP-2', 'cf-emp-EMP-1', 'financial-correction-employee-back']), visibleText: Object.freeze(['Борис Ли', 'Анна Ким']), absentText: Object.freeze(['SHIFT-2', 'TYPE-WITHHOLDING']), expectedStateKeys: Object.freeze(['state-info', 'state-info']), expectedControlKeys: Object.freeze(['navigation-open', 'navigation-open', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF11', event: secondContext }, { target: 'S03-CF11', event: firstContext }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF01', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF10:finished-shift', nodeId: 'S03-CF10', context: Object.freeze({}), apiResponse: P4A1_FINISHED_RESPONSE, orderedItemIds: Object.freeze(['cf-emp-EMP-3', 'financial-correction-employee-back']), visibleText: Object.freeze(['Вера Юн', 'Назад']), absentText: Object.freeze(['14:00', 'SHIFT-3']), expectedStateKeys: Object.freeze(['state-info']), expectedControlKeys: Object.freeze(['navigation-open', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF11', event: finishedContext }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF01', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF10:long-name', nodeId: 'S03-CF10', context: Object.freeze({}), apiResponse: P4A1_LONG_RESPONSE, orderedItemIds: Object.freeze(['cf-emp-EMP-LONG', 'financial-correction-employee-back']), visibleText: Object.freeze(['Очень длинное имя сотрудника', 'Назад']), absentText: Object.freeze(['SHIFT-LONG', 'undefined']), expectedStateKeys: Object.freeze(['state-info']), expectedControlKeys: Object.freeze(['navigation-open', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF11', event: longContext }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF01', expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-CF11:selected-first', nodeId: 'S03-CF11', context: firstContext, apiResponse: P4A1_EMPLOYEES_RESPONSE, orderedItemIds: Object.freeze(['financial-correction-selected-employee', 'financial-correction-accrual', 'financial-correction-withholding', 'financial-correction-mode-back']), visibleText: Object.freeze(['Финансовая корректировка', 'Анна Ким', 'Начислить', 'Удержать', 'Назад']), absentText: Object.freeze(['Борис Ли', 'SHIFT-1', 'TYPE-ACCRUAL', 'S03-CF11']), expectedStateKeys: Object.freeze(['state-info']), expectedControlKeys: Object.freeze(['action-positive', 'action-danger', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF12', event: { ...firstContext, correction_mode: 'accrual', salary_correction_type_id: 'TYPE-ACCRUAL' } }, { target: 'S03-CF12', event: { ...firstContext, correction_mode: 'withholding', salary_correction_type_id: 'TYPE-WITHHOLDING' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF10', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF11:selected-second', nodeId: 'S03-CF11', context: secondContext, apiResponse: P4A1_EMPLOYEES_RESPONSE, orderedItemIds: Object.freeze(['financial-correction-selected-employee', 'financial-correction-accrual', 'financial-correction-withholding', 'financial-correction-mode-back']), visibleText: Object.freeze(['Борис Ли', 'Начислить', 'Удержать']), absentText: Object.freeze(['Анна Ким', 'SHIFT-2']), expectedStateKeys: Object.freeze(['state-info']), expectedControlKeys: Object.freeze(['action-positive', 'action-danger', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF12', event: { ...secondContext, correction_mode: 'accrual', salary_correction_type_id: 'TYPE-ACCRUAL' } }, { target: 'S03-CF12', event: { ...secondContext, correction_mode: 'withholding', salary_correction_type_id: 'TYPE-WITHHOLDING' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF10', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF11:finished-shift', nodeId: 'S03-CF11', context: finishedContext, apiResponse: P4A1_FINISHED_RESPONSE, orderedItemIds: Object.freeze(['financial-correction-selected-employee', 'financial-correction-accrual', 'financial-correction-withholding', 'financial-correction-mode-back']), visibleText: Object.freeze(['Вера Юн', 'Начислить', 'Удержать']), absentText: Object.freeze(['14:00', 'SHIFT-3']), expectedStateKeys: Object.freeze(['state-info']), expectedControlKeys: Object.freeze(['action-positive', 'action-danger', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF12', event: { ...finishedContext, correction_mode: 'accrual', salary_correction_type_id: 'TYPE-ACCRUAL' } }, { target: 'S03-CF12', event: { ...finishedContext, correction_mode: 'withholding', salary_correction_type_id: 'TYPE-WITHHOLDING' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF10', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF11:long-name', nodeId: 'S03-CF11', context: longContext, apiResponse: P4A1_LONG_RESPONSE, orderedItemIds: Object.freeze(['financial-correction-selected-employee', 'financial-correction-accrual', 'financial-correction-withholding', 'financial-correction-mode-back']), visibleText: Object.freeze(['Очень длинное имя сотрудника', 'Начислить', 'Удержать']), absentText: Object.freeze(['SHIFT-LONG', 'undefined']), expectedStateKeys: Object.freeze(['state-info']), expectedControlKeys: Object.freeze(['action-positive', 'action-danger', 'navigation-back']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-CF12', event: { ...longContext, correction_mode: 'accrual', salary_correction_type_id: 'TYPE-ACCRUAL' } }, { target: 'S03-CF12', event: { ...longContext, correction_mode: 'withholding', salary_correction_type_id: 'TYPE-WITHHOLDING' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF10', expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-CF11:missing-employee', nodeId: 'S03-CF11', context: Object.freeze({ employee_id: 'EMP-MISSING', employee_shift_id: 'SHIFT-1' }), apiResponse: P4A1_EMPLOYEES_RESPONSE, orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedControlKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF10', expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-CF11:shift-id-mismatch', nodeId: 'S03-CF11', context: Object.freeze({ employee_id: 'EMP-1', employee_shift_id: 'SHIFT-WRONG' }), apiResponse: P4A1_EMPLOYEES_RESPONSE, orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedControlKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-CF10', expectProjectionFailure: true }),
] as const satisfies readonly Section03P4A1Fixture[]);

export const SECTION03_P4A1_FIXTURE_IDS = Object.freeze(SECTION03_P4A1_FIXTURES.map((fixture) => fixture.fixtureId));
