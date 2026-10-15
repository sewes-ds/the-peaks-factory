import type {
  ManagerAdditionalWorkItem,
  ManagerAdditionalWorksResponse,
  ManagerAdditionalWorkStatus,
} from '../contracts';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program';

type Request = Readonly<{ method: 'GET' | 'POST'; path: string; body?: Readonly<Record<string, string>> }>;
type Navigation = Readonly<{ target: string; event: Section03Context }>;

export type Section03P3A1Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-AW01' | 'S03-AW10' | 'S03-AW11' | 'S03-AW12';
  context: Section03Context;
  apiResponse: ManagerAdditionalWorksResponse;
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

const requestedFirst = work('requested', 'REQ-1', 'Анна Ким', 'Проверить комплектность');
const requestedSecond = work('requested', 'REQ-2', 'Борис Ли', 'Пересчитать оснастку');
const approved = work('approved', 'APP-1', 'Вера Юн', 'Подготовить упаковку');
const active = work('active', 'ACT-1', 'Глеб Орлов', 'Инвентаризация участка');
const waiting = work('waiting_accrual', 'WAIT-1', 'Дарья Соколова', 'Очистка рабочей зоны');
const longRequested = work(
  'requested',
  'REQ-LONG',
  'Очень длинное имя сотрудника для проверки переноса и автоматического роста строки без обрезания',
  'Очень длинное название дополнительной работы для проверки многострочного отображения полного содержания без горизонтального переполнения',
);
const mixed = response({ requested: [requestedFirst, requestedSecond], approved: [approved], active: [active], waiting_accrual: [waiting] });
const requestedOnly = response({ requested: [requestedFirst] });
const requestedTwo = response({ requested: [requestedFirst, requestedSecond] });
const longOnly = response({ requested: [longRequested] });

const get = Object.freeze({ method: 'GET' as const, path: '/manager/additional-works' });
const approvePost = (id: string) => Object.freeze({ method: 'POST' as const, path: `/additional-works/${id}/approve-request`, body: Object.freeze({ comment: 'Согласовано начальником производства' }) });
const rejectPost = (id: string) => Object.freeze({ method: 'POST' as const, path: `/additional-works/${id}/reject-request`, body: Object.freeze({ reason: 'Отклонено начальником производства' }) });

export const SECTION03_P3A1_FIXTURES = Object.freeze([
  Object.freeze({ fixtureId: 'S03-AW01:mixed-groups', nodeId: 'S03-AW01', context: Object.freeze({}), apiResponse: mixed, orderedItemIds: Object.freeze(['additional-work-group-requested', 'aw-REQ-1', 'aw-REQ-2', 'additional-work-group-approved', 'aw-APP-1', 'additional-work-group-active', 'aw-ACT-1', 'additional-work-group-waiting_accrual', 'aw-WAIT-1', 'additional-work-assign', 'additional-works-back']), visibleText: Object.freeze(['Доп. работы', 'Запрошено', 'Анна Ким\nПроверить комплектность', 'Согласовано', 'В работе', 'Требуют начисления', 'Назначить доп. работу', 'Назад']), absentText: Object.freeze(['S03-AW01', 'Нет доп. работ для отображения.']), expectedStateKeys: Object.freeze(['state-info', 'state-neutral', 'state-neutral', 'state-info', 'state-positive-neutral-context', 'state-info', 'state-positive', 'state-info', 'state-positive']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigate1', 'navigate2', 'navigate4', 'navigate3', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW10', event: { additional_work_id: 'REQ-1' } }, { target: 'S03-AW10', event: { additional_work_id: 'REQ-2' } }, { target: 'S03-AW20', event: { additional_work_id: 'APP-1' } }, { target: 'S03-AW30', event: { additional_work_id: 'ACT-1' } }, { target: 'S03-AW50', event: { additional_work_id: 'WAIT-1' } }, { target: 'S03-AW40', event: {} }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-N01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW01:empty', nodeId: 'S03-AW01', context: Object.freeze({}), apiResponse: response({}), orderedItemIds: Object.freeze(['additional-work-group-requested', 'additional-work-group-requested-empty', 'additional-work-group-approved', 'additional-work-group-approved-empty', 'additional-work-group-active', 'additional-work-group-active-empty', 'additional-work-group-waiting_accrual', 'additional-work-group-waiting_accrual-empty', 'additional-work-assign', 'additional-works-back']), visibleText: Object.freeze(['Доп. работы', 'Запрошено', 'Согласовано', 'В работе', 'Требуют начисления', 'Нет работ', 'Назначить доп. работу', 'Назад']), absentText: Object.freeze([]), expectedStateKeys: Object.freeze(['state-info', 'state-neutral', 'state-info', 'state-neutral', 'state-info', 'state-neutral', 'state-info', 'state-neutral']), expectedActionIds: Object.freeze(['navigate3', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW40', event: {} }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-N01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW01:backend-order', nodeId: 'S03-AW01', context: Object.freeze({}), apiResponse: response({ requested: [requestedSecond, requestedFirst] }), orderedItemIds: Object.freeze(['additional-work-group-requested', 'aw-REQ-2', 'aw-REQ-1', 'additional-work-group-approved', 'additional-work-group-approved-empty', 'additional-work-group-active', 'additional-work-group-active-empty', 'additional-work-group-waiting_accrual', 'additional-work-group-waiting_accrual-empty', 'additional-work-assign', 'additional-works-back']), visibleText: Object.freeze(['Борис Ли\nПересчитать оснастку', 'Анна Ким\nПроверить комплектность', 'Согласовано', 'В работе', 'Требуют начисления', 'Нет работ']), absentText: Object.freeze([]), expectedStateKeys: Object.freeze(['state-info', 'state-neutral', 'state-neutral', 'state-info', 'state-neutral', 'state-info', 'state-neutral', 'state-info', 'state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate0', 'navigate3', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW10', event: { additional_work_id: 'REQ-2' } }, { target: 'S03-AW10', event: { additional_work_id: 'REQ-1' } }, { target: 'S03-AW40', event: {} }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-N01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW01:long-content', nodeId: 'S03-AW01', context: Object.freeze({}), apiResponse: longOnly, orderedItemIds: Object.freeze(['additional-work-group-requested', 'aw-REQ-LONG', 'additional-work-group-approved', 'additional-work-group-approved-empty', 'additional-work-group-active', 'additional-work-group-active-empty', 'additional-work-group-waiting_accrual', 'additional-work-group-waiting_accrual-empty', 'additional-work-assign', 'additional-works-back']), visibleText: Object.freeze(['Очень длинное имя сотрудника', 'Очень длинное название дополнительной работы', 'Нет работ']), absentText: Object.freeze(['S03-AW01', 'undefined']), expectedStateKeys: Object.freeze(['state-info', 'state-neutral', 'state-info', 'state-neutral', 'state-info', 'state-neutral', 'state-info', 'state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate3', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW10', event: { additional_work_id: 'REQ-LONG' } }, { target: 'S03-AW40', event: {} }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-N01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW10:requested', nodeId: 'S03-AW10', context: Object.freeze({ additional_work_id: 'REQ-1' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze(['additional-work-request-card', 'additional-work-request-open-approve', 'additional-work-request-open-reject', 'additional-work-request-back']), visibleText: Object.freeze(['Сотрудник', 'Анна Ким', 'Вид работы', 'Проверить комплектность', 'Согласовать', 'Отклонить', 'Назад']), absentText: Object.freeze(['ФИО', 'S03-AW10', 'Подтвердите действие']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate1', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW11', event: { additional_work_id: 'REQ-1' } }, { target: 'S03-AW12', event: { additional_work_id: 'REQ-1' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW10:selected-second-item', nodeId: 'S03-AW10', context: Object.freeze({ additional_work_id: 'REQ-2' }), apiResponse: requestedTwo, orderedItemIds: Object.freeze(['additional-work-request-card', 'additional-work-request-open-approve', 'additional-work-request-open-reject', 'additional-work-request-back']), visibleText: Object.freeze(['Борис Ли', 'Пересчитать оснастку', 'Согласовать', 'Отклонить']), absentText: Object.freeze(['Анна Ким', 'Проверить комплектность']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['navigate0', 'navigate1', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW11', event: { additional_work_id: 'REQ-2' } }, { target: 'S03-AW12', event: { additional_work_id: 'REQ-2' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW10:missing-selected-id', nodeId: 'S03-AW10', context: Object.freeze({ additional_work_id: 'REQ-MISSING' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW10:wrong-status', nodeId: 'S03-AW10', context: Object.freeze({ additional_work_id: 'APP-1' }), apiResponse: response({ requested: [requestedFirst], approved: [approved] }), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW11:authorized', nodeId: 'S03-AW11', context: Object.freeze({ additional_work_id: 'REQ-1' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze(['additional-work-request-approve-prompt', 'additional-work-request-approve-card', 'additional-work-request-approve', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Согласовать', 'Сотрудник', 'Анна Ким', 'Вид работы', 'Проверить комплектность', 'Назад']), absentText: Object.freeze(['ФИО', 'Отклонить', 'S03-AW11']), expectedStateKeys: Object.freeze(['state-positive', 'state-positive']), expectedActionIds: Object.freeze(['APPROVE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, approvePost('REQ-1'), get]), backTarget: 'S03-AW10', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW11:pending-duplicate', nodeId: 'S03-AW11', context: Object.freeze({ additional_work_id: 'REQ-1' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze(['additional-work-request-approve-prompt', 'additional-work-request-approve-card', 'additional-work-request-approve', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Согласовать', 'Анна Ким']), absentText: Object.freeze(['Отклонить']), expectedStateKeys: Object.freeze(['state-positive', 'state-positive']), expectedActionIds: Object.freeze(['APPROVE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, approvePost('REQ-1'), get]), backTarget: 'S03-AW10', pending: true, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW11:request-failure', nodeId: 'S03-AW11', context: Object.freeze({ additional_work_id: 'REQ-1' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze(['additional-work-request-approve-prompt', 'additional-work-request-approve-card', 'additional-work-request-approve', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Согласовать', 'Проверить комплектность']), absentText: Object.freeze(['Отклонить']), expectedStateKeys: Object.freeze(['state-positive', 'state-positive']), expectedActionIds: Object.freeze(['APPROVE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, approvePost('REQ-1')]), backTarget: 'S03-AW10', pending: false, requestFailure: true, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW11:long-content', nodeId: 'S03-AW11', context: Object.freeze({ additional_work_id: 'REQ-LONG' }), apiResponse: longOnly, orderedItemIds: Object.freeze(['additional-work-request-approve-prompt', 'additional-work-request-approve-card', 'additional-work-request-approve', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Согласовать', 'Очень длинное имя сотрудника', 'Очень длинное название дополнительной работы']), absentText: Object.freeze(['Отклонить']), expectedStateKeys: Object.freeze(['state-positive', 'state-positive']), expectedActionIds: Object.freeze(['APPROVE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, approvePost('REQ-LONG'), get]), backTarget: 'S03-AW10', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW12:authorized', nodeId: 'S03-AW12', context: Object.freeze({ additional_work_id: 'REQ-1' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze(['additional-work-request-reject-prompt', 'additional-work-request-reject-card', 'additional-work-request-reject', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Отклонить', 'Сотрудник', 'Анна Ким', 'Вид работы', 'Проверить комплектность', 'Назад']), absentText: Object.freeze(['ФИО', 'Согласовать', 'S03-AW12']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['REJECT_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, rejectPost('REQ-1'), get]), backTarget: 'S03-AW10', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW12:pending-duplicate', nodeId: 'S03-AW12', context: Object.freeze({ additional_work_id: 'REQ-1' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze(['additional-work-request-reject-prompt', 'additional-work-request-reject-card', 'additional-work-request-reject', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Отклонить', 'Анна Ким']), absentText: Object.freeze(['Согласовать']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['REJECT_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, rejectPost('REQ-1'), get]), backTarget: 'S03-AW10', pending: true, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW12:request-failure', nodeId: 'S03-AW12', context: Object.freeze({ additional_work_id: 'REQ-1' }), apiResponse: requestedOnly, orderedItemIds: Object.freeze(['additional-work-request-reject-prompt', 'additional-work-request-reject-card', 'additional-work-request-reject', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Отклонить', 'Проверить комплектность']), absentText: Object.freeze(['Согласовать']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['REJECT_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, rejectPost('REQ-1')]), backTarget: 'S03-AW10', pending: false, requestFailure: true, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW12:long-content', nodeId: 'S03-AW12', context: Object.freeze({ additional_work_id: 'REQ-LONG' }), apiResponse: longOnly, orderedItemIds: Object.freeze(['additional-work-request-reject-prompt', 'additional-work-request-reject-card', 'additional-work-request-reject', 'additional-work-request-decision-back']), visibleText: Object.freeze(['Подтвердите действие: Отклонить', 'Очень длинное имя сотрудника', 'Очень длинное название дополнительной работы']), absentText: Object.freeze(['Согласовать']), expectedStateKeys: Object.freeze(['state-neutral', 'state-neutral']), expectedActionIds: Object.freeze(['REJECT_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, rejectPost('REQ-LONG'), get]), backTarget: 'S03-AW10', pending: false, requestFailure: false, expectProjectionFailure: false }),
] as const satisfies readonly Section03P3A1Fixture[]);

export const SECTION03_P3A1_FIXTURE_IDS = Object.freeze(
  SECTION03_P3A1_FIXTURES.map((fixture) => fixture.fixtureId),
);
