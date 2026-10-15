import type {
  AdditionalWorkAssignmentBlockedCode,
  ManagerAdditionalWorkTypesAvailableResponse,
  ManagerEmployees,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';

type Request = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  body?: Readonly<Record<string, string>>;
}>;
type Navigation = Readonly<{ target: string; event: Section03Context }>;

export type Section03P3A3Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-AW40' | 'S03-AW41' | 'S03-AW42';
  context: Section03Context;
  apiResponse: ManagerEmployees | ManagerAdditionalWorkTypesAvailableResponse;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedNavigations: readonly Navigation[];
  expectedRequests: readonly Request[];
  backTarget: Section03NodeId;
  pending: boolean;
  requestFailure: boolean;
  expectContextFailure: boolean;
}>;

function employee(employeeId: string, fullName: string) {
  return Object.freeze({
    employee_id: employeeId,
    full_name: fullName,
    ui_state: 'shift_idle' as const,
    ui_variant: 'light_blue' as const,
    open_shift_id: `SHIFT-${employeeId}`,
    shift_started_at: '2026-08-02T08:00:00+05:00',
    active_production_operation_id: null,
    production_started_at: null,
    active_machine_id: null,
    active_machine_name: null,
    active_sku_id: null,
    active_sku_code: null,
    active_sku_name: null,
    active_break_id: null,
    active_break_name: null,
    break_started_at: null,
    break_duration: null,
    active_downtime_id: null,
    downtime_type: null,
    downtime_name: null,
    downtime_comment: null,
    downtime_started_at: null,
    downtime_duration: null,
    downtime_start_comment: null,
    downtime_finish_comment: null,
    active_additional_work_id: null,
    active_additional_work_name: null,
    additional_work_started_at: null,
    additional_work_duration: null,
    available_actions: Object.freeze(['OPEN_EMPLOYEE_CARD'] as const),
  });
}

function employeesResponse(employees: readonly ReturnType<typeof employee>[]): ManagerEmployees {
  return Object.freeze({
    section: 'S03',
    screen: 'S03-E01',
    title: 'Сотрудники',
    employees: Object.freeze([...employees]),
    available_actions: Object.freeze(['BACK'] as const),
  });
}

function workType(
  id: string,
  name: string,
  displayOrder: number,
  assignability: Readonly<{
    isActive?: boolean;
    canAssign?: boolean;
    blockedCode?: AdditionalWorkAssignmentBlockedCode | null;
    blockedMessage?: string | null;
  }> = {},
) {
  const canAssign = assignability.canAssign ?? true;
  return Object.freeze({
    additional_work_type_id: id,
    additional_work_name: name,
    is_active: assignability.isActive ?? true,
    display_order: displayOrder,
    can_assign: canAssign,
    blocked_code: assignability.blockedCode ?? null,
    blocked_message: assignability.blockedMessage ?? null,
  });
}

function workTypesResponse(
  additionalWorkTypes: readonly ReturnType<typeof workType>[],
  employeeId: string,
  selectedTypeId: string | null = null,
): ManagerAdditionalWorkTypesAvailableResponse {
  return Object.freeze({
    section: 'S03',
    screen: 'S03-AW41',
    assignability_employee_id: employeeId,
    assignability_additional_work_type_id: selectedTypeId,
    additional_work_types: Object.freeze([...additionalWorkTypes]),
    available_actions: Object.freeze(
      additionalWorkTypes.some((item) => item.can_assign)
        ? (['ASSIGN_ADDITIONAL_WORK', 'BACK'] as const)
        : (['BACK'] as const),
    ),
  });
}

const employeeFirst = employee('EMP-1', 'Анна Ким');
const employeeSecond = employee('EMP-2', 'Борис Ли');
const employeeLong = employee(
  'EMP-LONG',
  'Александрова Екатерина Константиновна с очень длинным отображаемым именем сотрудника без обрезания',
);
const typeFirst = workType('TYPE-1', 'Проверить комплектность', 10);
const typeSecond = workType('TYPE-2', 'Инвентаризация участка', 20);
const typeSecondBlocked = workType('TYPE-2', 'Инвентаризация участка', 20, {
  canAssign: false,
  blockedCode: 'additional_work_assignment_already_exists',
  blockedMessage: 'Для сотрудника уже есть незавершённое назначение этого вида доп. работы.',
});
const typeLong = workType(
  'TYPE-LONG',
  'Очень длинное название дополнительной работы для проверки многострочного отображения без горизонтального переполнения',
  30,
);

export const P3A3_EMPLOYEES_RESPONSE = employeesResponse([employeeFirst, employeeSecond]);
export const P3A3_EMPLOYEES_EMPTY_RESPONSE = employeesResponse([]);
export const P3A3_EMPLOYEES_BACKEND_ORDER_RESPONSE = employeesResponse([employeeSecond, employeeFirst]);
export const P3A3_EMPLOYEES_LONG_RESPONSE = employeesResponse([employeeLong]);
export const P3A3_WORK_TYPES_RESPONSE = workTypesResponse([typeFirst, typeSecond], 'EMP-2');
export const P3A3_WORK_TYPES_EMPTY_RESPONSE = workTypesResponse([], 'EMP-2');
export const P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE = workTypesResponse([typeSecond, typeFirst], 'EMP-2');
export const P3A3_WORK_TYPES_LONG_RESPONSE = workTypesResponse([typeLong], 'EMP-LONG');
export const P3A3_ASSIGN_AUTHORITY_RESPONSE = workTypesResponse([typeSecond], 'EMP-2', 'TYPE-2');
export const P3A3_ASSIGN_BLOCKED_RESPONSE = workTypesResponse([typeSecondBlocked], 'EMP-2', 'TYPE-2');

const employeeContext = Object.freeze({ employee_id: 'EMP-2', employee_full_name: 'Борис Ли' });
const assignmentContext = Object.freeze({
  employee_id: 'EMP-2',
  employee_full_name: 'Борис Ли',
  additional_work_type_id: 'TYPE-2',
  additional_work_type_name: 'Инвентаризация участка',
});
const longAssignmentContext = Object.freeze({
  employee_id: 'EMP-LONG',
  employee_full_name: employeeLong.full_name,
  additional_work_type_id: 'TYPE-LONG',
  additional_work_type_name: typeLong.additional_work_name,
});
const getEmployees = Object.freeze({ method: 'GET' as const, path: '/manager/employees' });
const getTypes = (employeeId: string, workTypeId?: string) => Object.freeze({
  method: 'GET' as const,
  path: `/manager/additional-work-types/available?employee_id=${employeeId}${
    workTypeId === undefined ? '' : `&additional_work_type_id=${workTypeId}`
  }`,
});
const getWorks = Object.freeze({ method: 'GET' as const, path: '/manager/additional-works' });
const assignPost = Object.freeze({
  method: 'POST' as const,
  path: '/additional-works/assign',
  body: Object.freeze({ employee_id: 'EMP-2', additional_work_type_id: 'TYPE-2' }),
});

export const SECTION03_P3A3_FIXTURES = Object.freeze([
  Object.freeze({ fixtureId: 'S03-AW40:employees', nodeId: 'S03-AW40', context: Object.freeze({}), apiResponse: P3A3_EMPLOYEES_RESPONSE, orderedItemIds: Object.freeze(['aw-emp-EMP-1', 'aw-emp-EMP-2', 'assign-employee-back']), visibleText: Object.freeze(['Выберите сотрудника', 'Анна Ким', 'Борис Ли', 'Назад']), absentText: Object.freeze(['S03-AW40', 'Сотрудник без работы']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW41', event: { employee_id: 'EMP-1', employee_full_name: 'Анна Ким' } }, { target: 'S03-AW41', event: employeeContext }]), expectedRequests: Object.freeze([getEmployees]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW40:empty', nodeId: 'S03-AW40', context: Object.freeze({}), apiResponse: P3A3_EMPLOYEES_EMPTY_RESPONSE, orderedItemIds: Object.freeze(['assign-employee-empty', 'assign-employee-back']), visibleText: Object.freeze(['Выберите сотрудника', 'Нет сотрудников.', 'Назад']), absentText: Object.freeze(['Анна Ким']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([getEmployees]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW40:backend-order', nodeId: 'S03-AW40', context: Object.freeze({}), apiResponse: P3A3_EMPLOYEES_BACKEND_ORDER_RESPONSE, orderedItemIds: Object.freeze(['aw-emp-EMP-2', 'aw-emp-EMP-1', 'assign-employee-back']), visibleText: Object.freeze(['Борис Ли', 'Анна Ким']), absentText: Object.freeze(['S03-AW40']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW41', event: employeeContext }, { target: 'S03-AW41', event: { employee_id: 'EMP-1', employee_full_name: 'Анна Ким' } }]), expectedRequests: Object.freeze([getEmployees]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW40:long-name', nodeId: 'S03-AW40', context: Object.freeze({}), apiResponse: P3A3_EMPLOYEES_LONG_RESPONSE, orderedItemIds: Object.freeze(['aw-emp-EMP-LONG', 'assign-employee-back']), visibleText: Object.freeze(['с очень длинным отображаемым именем сотрудника', 'Назад']), absentText: Object.freeze(['undefined', 'S03-AW40']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW41', event: { employee_id: 'EMP-LONG', employee_full_name: employeeLong.full_name } }]), expectedRequests: Object.freeze([getEmployees]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectContextFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW41:types', nodeId: 'S03-AW41', context: employeeContext, apiResponse: P3A3_WORK_TYPES_RESPONSE, orderedItemIds: Object.freeze(['aw-type-TYPE-1', 'aw-type-TYPE-2', 'assign-work-type-back']), visibleText: Object.freeze(['Выберите доп. работу', 'Проверить комплектность', 'Инвентаризация участка', 'Назад']), absentText: Object.freeze(['S03-AW41', 'Борис Ли']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW42', event: { ...employeeContext, additional_work_type_id: 'TYPE-1', additional_work_type_name: 'Проверить комплектность' } }, { target: 'S03-AW42', event: assignmentContext }]), expectedRequests: Object.freeze([getTypes('EMP-2')]), backTarget: 'S03-AW40', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW41:empty', nodeId: 'S03-AW41', context: employeeContext, apiResponse: P3A3_WORK_TYPES_EMPTY_RESPONSE, orderedItemIds: Object.freeze(['assign-work-type-empty', 'assign-work-type-back']), visibleText: Object.freeze(['Выберите доп. работу', 'Нет доступных типов доп. работ.', 'Назад']), absentText: Object.freeze(['Инвентаризация участка']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([getTypes('EMP-2')]), backTarget: 'S03-AW40', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW41:backend-order', nodeId: 'S03-AW41', context: employeeContext, apiResponse: P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE, orderedItemIds: Object.freeze(['aw-type-TYPE-2', 'aw-type-TYPE-1', 'assign-work-type-back']), visibleText: Object.freeze(['Инвентаризация участка', 'Проверить комплектность']), absentText: Object.freeze(['S03-AW41']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW42', event: assignmentContext }, { target: 'S03-AW42', event: { ...employeeContext, additional_work_type_id: 'TYPE-1', additional_work_type_name: 'Проверить комплектность' } }]), expectedRequests: Object.freeze([getTypes('EMP-2')]), backTarget: 'S03-AW40', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW41:long-name', nodeId: 'S03-AW41', context: { employee_id: 'EMP-LONG', employee_full_name: employeeLong.full_name }, apiResponse: P3A3_WORK_TYPES_LONG_RESPONSE, orderedItemIds: Object.freeze(['aw-type-TYPE-LONG', 'assign-work-type-back']), visibleText: Object.freeze(['Очень длинное название дополнительной работы', 'Назад']), absentText: Object.freeze(['undefined', 'S03-AW41']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW42', event: longAssignmentContext }]), expectedRequests: Object.freeze([getTypes('EMP-LONG')]), backTarget: 'S03-AW40', pending: false, requestFailure: false, expectContextFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW42:authorized', nodeId: 'S03-AW42', context: assignmentContext, apiResponse: P3A3_ASSIGN_AUTHORITY_RESPONSE, orderedItemIds: Object.freeze(['assign-additional-work-card', 'assign-additional-work', 'assign-additional-work-back']), visibleText: Object.freeze(['Подтвердите назначение доп. работы:', 'Сотрудник', 'Борис Ли', 'Вид работы', 'Инвентаризация участка', 'Назначить доп. работу', 'Назад']), absentText: Object.freeze(['ФИО', 'S03-AW42', 'employee_id']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['ASSIGN_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([getTypes('EMP-2', 'TYPE-2'), assignPost, getWorks]), backTarget: 'S03-AW41', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW42:pending-duplicate', nodeId: 'S03-AW42', context: assignmentContext, apiResponse: P3A3_ASSIGN_AUTHORITY_RESPONSE, orderedItemIds: Object.freeze(['assign-additional-work-card', 'assign-additional-work', 'assign-additional-work-back']), visibleText: Object.freeze(['Подтвердите назначение доп. работы:', 'Борис Ли', 'Инвентаризация участка']), absentText: Object.freeze(['S03-AW42']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['ASSIGN_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([getTypes('EMP-2', 'TYPE-2'), assignPost, getWorks]), backTarget: 'S03-AW41', pending: true, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW42:request-failure', nodeId: 'S03-AW42', context: assignmentContext, apiResponse: P3A3_ASSIGN_AUTHORITY_RESPONSE, orderedItemIds: Object.freeze(['assign-additional-work-card', 'assign-additional-work', 'assign-additional-work-back']), visibleText: Object.freeze(['Подтвердите назначение доп. работы:', 'Борис Ли', 'Инвентаризация участка']), absentText: Object.freeze(['S03-AW42']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['ASSIGN_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([getTypes('EMP-2', 'TYPE-2'), assignPost]), backTarget: 'S03-AW41', pending: false, requestFailure: true, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW42:long-content', nodeId: 'S03-AW42', context: longAssignmentContext, apiResponse: workTypesResponse([typeLong], 'EMP-LONG', 'TYPE-LONG'), orderedItemIds: Object.freeze(['assign-additional-work-card', 'assign-additional-work', 'assign-additional-work-back']), visibleText: Object.freeze(['с очень длинным отображаемым именем сотрудника', 'Очень длинное название дополнительной работы']), absentText: Object.freeze(['undefined', 'S03-AW42']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['ASSIGN_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([getTypes('EMP-LONG', 'TYPE-LONG')]), backTarget: 'S03-AW41', pending: false, requestFailure: false, expectContextFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW42:missing-employee-name', nodeId: 'S03-AW42', context: { employee_id: 'EMP-2', additional_work_type_id: 'TYPE-2', additional_work_type_name: 'Инвентаризация участка' }, apiResponse: P3A3_ASSIGN_AUTHORITY_RESPONSE, orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW41', pending: false, requestFailure: false, expectContextFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW42:missing-type-name', nodeId: 'S03-AW42', context: { employee_id: 'EMP-2', employee_full_name: 'Борис Ли', additional_work_type_id: 'TYPE-2' }, apiResponse: P3A3_ASSIGN_AUTHORITY_RESPONSE, orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW41', pending: false, requestFailure: false, expectContextFailure: true }),
] as const satisfies readonly Section03P3A3Fixture[]);

export const SECTION03_P3A3_FIXTURE_IDS = Object.freeze(
  SECTION03_P3A3_FIXTURES.map((fixture) => fixture.fixtureId),
);
