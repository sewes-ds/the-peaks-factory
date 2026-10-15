import type {
  ManagerAdditionalWorkItem,
  ManagerAdditionalWorksResponse,
  ManagerAdditionalWorkStatus,
} from '../contracts';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program';

type Request = Readonly<{ method: 'GET' | 'POST'; path: string; body?: Readonly<Record<string, string>> }>;
type Navigation = Readonly<{ target: string; event: Section03Context }>;

export type Section03P3A2Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-AW20' | 'S03-AW21' | 'S03-AW30' | 'S03-AW31';
  context: Section03Context;
  apiResponse: ManagerAdditionalWorksResponse;
  selectedId: string;
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
  expectProjectionFailure: boolean;
}>;

const actionSets = Object.freeze({
  requested: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'APPROVE_ADDITIONAL_WORK_REQUEST', 'REJECT_ADDITIONAL_WORK_REQUEST'] as const),
  approved: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'CANCEL_ADDITIONAL_WORK'] as const),
  active: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'FINISH_ADDITIONAL_WORK'] as const),
  waiting_accrual: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'ACCRUE_ADDITIONAL_WORK_SALARY', 'MARK_WITHOUT_ACCRUAL'] as const),
});

function work(
  status: ManagerAdditionalWorkStatus,
  id: string,
  employee: string,
  name: string,
): ManagerAdditionalWorkItem {
  return Object.freeze({
    additional_work_id: id,
    additional_work_type_id: `TYPE-${id}`,
    additional_work_name: name,
    employee_id: `EMP-${id}`,
    employee_full_name: employee,
    requested_at: status === 'requested' ? '2026-08-02T08:00:00Z' : null,
    created_at: '2026-08-02T07:00:00Z',
    started_at: status === 'active' || status === 'waiting_accrual' ? '2026-08-02T09:00:00Z' : null,
    finished_at: status === 'waiting_accrual' ? '2026-08-02T10:00:00Z' : null,
    status,
    ui_state: status,
    ui_variant: status === 'requested' || status === 'approved' ? 'grey' : 'green',
    available_actions: actionSets[status],
  });
}

function response(input: Partial<Record<ManagerAdditionalWorkStatus, readonly ManagerAdditionalWorkItem[]>>): ManagerAdditionalWorksResponse {
  return Object.freeze({
    section: 'S03', screen: 'S03-AW01', title: 'Доп. работы',
    groups: Object.freeze({
      requested: Object.freeze(input.requested ?? []),
      approved: Object.freeze(input.approved ?? []),
      active: Object.freeze(input.active ?? []),
      waiting_accrual: Object.freeze(input.waiting_accrual ?? []),
    }),
    available_actions: Object.freeze(['ASSIGN_ADDITIONAL_WORK', 'BACK'] as const),
  });
}

const approvedFirst = work('approved', 'APP-1', 'Вера Юн', 'Подготовить упаковку');
const approvedSecond = work('approved', 'APP-2', 'Илья Серов', 'Проверить маркировку');
const activeFirst = work('active', 'ACT-1', 'Глеб Орлов', 'Инвентаризация участка');
const activeSecond = work('active', 'ACT-2', 'Кира Левина', 'Переместить оснастку');
const requested = work('requested', 'REQ-1', 'Анна Ким', 'Проверить комплектность');
const longApproved = work(
  'approved',
  'APP-LONG',
  'Очень длинное имя сотрудника для проверки переноса и автоматического роста карточки без обрезания',
  'Очень длинное название согласованной дополнительной работы для проверки полного многострочного отображения без горизонтального переполнения',
);
const longActive = work(
  'active',
  'ACT-LONG',
  'Очень длинное имя активного сотрудника для проверки переноса и автоматического роста карточки без обрезания',
  'Очень длинное название активной дополнительной работы для проверки полного многострочного отображения без горизонтального переполнения',
);

export const P3A2_APPROVED_RESPONSE = response({ approved: [approvedFirst] });
export const P3A2_ACTIVE_RESPONSE = response({ active: [activeFirst] });
export const P3A2_MIXED_RESPONSE = response({ requested: [requested], approved: [approvedFirst, approvedSecond], active: [activeFirst, activeSecond] });

const approvedTwo = response({ approved: [approvedFirst, approvedSecond] });
const activeTwo = response({ active: [activeFirst, activeSecond] });
const wrongForApproved = response({ requested: [requested], active: [activeFirst] });
const wrongForActive = response({ requested: [requested], approved: [approvedFirst] });
const longApprovedOnly = response({ approved: [longApproved] });
const longActiveOnly = response({ active: [longActive] });

const get = Object.freeze({ method: 'GET' as const, path: '/manager/additional-works' });
const cancelPost = (id: string) => Object.freeze({ method: 'POST' as const, path: `/additional-works/${id}/cancel`, body: Object.freeze({ reason: 'Отменено начальником производства' }) });
const finishPost = (id: string) => Object.freeze({ method: 'POST' as const, path: `/additional-works/${id}/finish`, body: Object.freeze({ comment: 'Завершено начальником производства' }) });

export const SECTION03_P3A2_FIXTURES = Object.freeze([
  Object.freeze({ fixtureId: 'S03-AW20:approved-authorized', nodeId: 'S03-AW20', context: Object.freeze({ additional_work_id: 'APP-1' }), apiResponse: P3A2_APPROVED_RESPONSE, selectedId: 'APP-1', orderedItemIds: Object.freeze(['additional-work-approved-card', 'additional-work-open-cancel', 'additional-work-lifecycle-card-back']), visibleText: Object.freeze(['Сотрудник', 'Вера Юн', 'Вид работы', 'Подготовить упаковку', 'Отменить', 'Назад']), absentText: Object.freeze(['ФИО', 'S03-AW20', 'Завершить доп. работу', 'Подтвердите действие']), expectedStateKeys: Object.freeze(['state-positive-neutral-context']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW21', event: { additional_work_id: 'APP-1' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW20:selected-second-item', nodeId: 'S03-AW20', context: Object.freeze({ additional_work_id: 'APP-2' }), apiResponse: approvedTwo, selectedId: 'APP-2', orderedItemIds: Object.freeze(['additional-work-approved-card', 'additional-work-open-cancel', 'additional-work-lifecycle-card-back']), visibleText: Object.freeze(['Илья Серов', 'Проверить маркировку', 'Отменить']), absentText: Object.freeze(['Вера Юн', 'Подготовить упаковку']), expectedStateKeys: Object.freeze(['state-positive-neutral-context']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW21', event: { additional_work_id: 'APP-2' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW20:missing-selected-id', nodeId: 'S03-AW20', context: Object.freeze({ additional_work_id: 'APP-MISSING' }), apiResponse: P3A2_APPROVED_RESPONSE, selectedId: 'APP-MISSING', orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW20:wrong-status', nodeId: 'S03-AW20', context: Object.freeze({ additional_work_id: 'ACT-1' }), apiResponse: wrongForApproved, selectedId: 'ACT-1', orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW20:long-content', nodeId: 'S03-AW20', context: Object.freeze({ additional_work_id: 'APP-LONG' }), apiResponse: longApprovedOnly, selectedId: 'APP-LONG', orderedItemIds: Object.freeze(['additional-work-approved-card', 'additional-work-open-cancel', 'additional-work-lifecycle-card-back']), visibleText: Object.freeze(['Очень длинное имя сотрудника', 'Очень длинное название согласованной дополнительной работы', 'Отменить']), absentText: Object.freeze(['undefined', 'S03-AW20']), expectedStateKeys: Object.freeze(['state-positive-neutral-context']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW21', event: { additional_work_id: 'APP-LONG' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW21:authorized', nodeId: 'S03-AW21', context: Object.freeze({ additional_work_id: 'APP-1' }), apiResponse: P3A2_APPROVED_RESPONSE, selectedId: 'APP-1', orderedItemIds: Object.freeze(['additional-work-cancel-card', 'additional-work-cancel', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Отменить', 'Сотрудник', 'Вера Юн', 'Вид работы', 'Подготовить упаковку', 'Назад']), absentText: Object.freeze(['ФИО', 'Завершить доп. работу', 'S03-AW21']), expectedStateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['CANCEL_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, cancelPost('APP-1'), get]), backTarget: 'S03-AW20', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW21:pending-duplicate', nodeId: 'S03-AW21', context: Object.freeze({ additional_work_id: 'APP-1' }), apiResponse: P3A2_APPROVED_RESPONSE, selectedId: 'APP-1', orderedItemIds: Object.freeze(['additional-work-cancel-card', 'additional-work-cancel', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Отменить', 'Вера Юн']), absentText: Object.freeze(['Завершить доп. работу']), expectedStateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['CANCEL_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, cancelPost('APP-1'), get]), backTarget: 'S03-AW20', pending: true, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW21:request-failure', nodeId: 'S03-AW21', context: Object.freeze({ additional_work_id: 'APP-1' }), apiResponse: P3A2_APPROVED_RESPONSE, selectedId: 'APP-1', orderedItemIds: Object.freeze(['additional-work-cancel-card', 'additional-work-cancel', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Отменить', 'Подготовить упаковку']), absentText: Object.freeze(['Завершить доп. работу']), expectedStateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['CANCEL_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, cancelPost('APP-1')]), backTarget: 'S03-AW20', pending: false, requestFailure: true, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW21:long-content', nodeId: 'S03-AW21', context: Object.freeze({ additional_work_id: 'APP-LONG' }), apiResponse: longApprovedOnly, selectedId: 'APP-LONG', orderedItemIds: Object.freeze(['additional-work-cancel-card', 'additional-work-cancel', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Отменить', 'Очень длинное имя сотрудника', 'Очень длинное название согласованной дополнительной работы']), absentText: Object.freeze(['Завершить доп. работу']), expectedStateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['CANCEL_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, cancelPost('APP-LONG'), get]), backTarget: 'S03-AW20', pending: false, requestFailure: false, expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW30:active-authorized', nodeId: 'S03-AW30', context: Object.freeze({ additional_work_id: 'ACT-1' }), apiResponse: P3A2_ACTIVE_RESPONSE, selectedId: 'ACT-1', orderedItemIds: Object.freeze(['additional-work-active-card', 'additional-work-open-finish', 'additional-work-lifecycle-card-back']), visibleText: Object.freeze(['Сотрудник', 'Глеб Орлов', 'Вид работы', 'Инвентаризация участка', 'Завершить доп. работу', 'Назад']), absentText: Object.freeze(['ФИО', 'S03-AW30', 'Отменить', 'Подтвердите действие']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW31', event: { additional_work_id: 'ACT-1' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW30:selected-second-item', nodeId: 'S03-AW30', context: Object.freeze({ additional_work_id: 'ACT-2' }), apiResponse: activeTwo, selectedId: 'ACT-2', orderedItemIds: Object.freeze(['additional-work-active-card', 'additional-work-open-finish', 'additional-work-lifecycle-card-back']), visibleText: Object.freeze(['Кира Левина', 'Переместить оснастку', 'Завершить доп. работу']), absentText: Object.freeze(['Глеб Орлов', 'Инвентаризация участка']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW31', event: { additional_work_id: 'ACT-2' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW30:missing-selected-id', nodeId: 'S03-AW30', context: Object.freeze({ additional_work_id: 'ACT-MISSING' }), apiResponse: P3A2_ACTIVE_RESPONSE, selectedId: 'ACT-MISSING', orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW30:wrong-status', nodeId: 'S03-AW30', context: Object.freeze({ additional_work_id: 'APP-1' }), apiResponse: wrongForActive, selectedId: 'APP-1', orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW30:long-content', nodeId: 'S03-AW30', context: Object.freeze({ additional_work_id: 'ACT-LONG' }), apiResponse: longActiveOnly, selectedId: 'ACT-LONG', orderedItemIds: Object.freeze(['additional-work-active-card', 'additional-work-open-finish', 'additional-work-lifecycle-card-back']), visibleText: Object.freeze(['Очень длинное имя активного сотрудника', 'Очень длинное название активной дополнительной работы', 'Завершить доп. работу']), absentText: Object.freeze(['undefined', 'S03-AW30']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW31', event: { additional_work_id: 'ACT-LONG' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW31:authorized', nodeId: 'S03-AW31', context: Object.freeze({ additional_work_id: 'ACT-1' }), apiResponse: P3A2_ACTIVE_RESPONSE, selectedId: 'ACT-1', orderedItemIds: Object.freeze(['additional-work-finish-card', 'additional-work-finish', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Завершить доп. работу', 'Сотрудник', 'Глеб Орлов', 'Вид работы', 'Инвентаризация участка', 'Назад']), absentText: Object.freeze(['ФИО', 'Отменить', 'S03-AW31']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['FINISH_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, finishPost('ACT-1'), get]), backTarget: 'S03-AW30', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW31:pending-duplicate', nodeId: 'S03-AW31', context: Object.freeze({ additional_work_id: 'ACT-1' }), apiResponse: P3A2_ACTIVE_RESPONSE, selectedId: 'ACT-1', orderedItemIds: Object.freeze(['additional-work-finish-card', 'additional-work-finish', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Завершить доп. работу', 'Глеб Орлов']), absentText: Object.freeze(['Отменить']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['FINISH_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, finishPost('ACT-1'), get]), backTarget: 'S03-AW30', pending: true, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW31:request-failure', nodeId: 'S03-AW31', context: Object.freeze({ additional_work_id: 'ACT-1' }), apiResponse: P3A2_ACTIVE_RESPONSE, selectedId: 'ACT-1', orderedItemIds: Object.freeze(['additional-work-finish-card', 'additional-work-finish', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Завершить доп. работу', 'Инвентаризация участка']), absentText: Object.freeze(['Отменить']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['FINISH_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, finishPost('ACT-1')]), backTarget: 'S03-AW30', pending: false, requestFailure: true, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW31:long-content', nodeId: 'S03-AW31', context: Object.freeze({ additional_work_id: 'ACT-LONG' }), apiResponse: longActiveOnly, selectedId: 'ACT-LONG', orderedItemIds: Object.freeze(['additional-work-finish-card', 'additional-work-finish', 'additional-work-lifecycle-confirm-back']), visibleText: Object.freeze(['Подтвердите действие: Завершить доп. работу', 'Очень длинное имя активного сотрудника', 'Очень длинное название активной дополнительной работы']), absentText: Object.freeze(['Отменить']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['FINISH_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, finishPost('ACT-LONG'), get]), backTarget: 'S03-AW30', pending: false, requestFailure: false, expectProjectionFailure: false }),
] as const satisfies readonly Section03P3A2Fixture[]);

export const SECTION03_P3A2_FIXTURE_IDS = Object.freeze(
  SECTION03_P3A2_FIXTURES.map((fixture) => fixture.fixtureId),
);
