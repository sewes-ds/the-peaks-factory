import type {
  ManagerAdditionalWorkItem,
  ManagerAdditionalWorksResponse,
  ManagerAdditionalWorkStatus,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';

type Request = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  body?: Readonly<Record<string, string | null>>;
}>;
type Navigation = Readonly<{ target: string; event: Section03Context }>;

export type Section03P3A4Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-AW50' | 'S03-AW51' | 'S03-AW52' | 'S03-AW53' | 'S03-AW54';
  context: Section03Context;
  apiResponse: ManagerAdditionalWorksResponse;
  formValue?: string;
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

const actionsByStatus = Object.freeze({
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
    ui_variant: status === 'waiting_accrual' || status === 'active' ? 'green' : 'grey',
    available_actions: actionsByStatus[status],
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

const first = work('waiting_accrual', 'WAIT-1', 'Вера Юн', 'Подготовить упаковку');
const second = work('waiting_accrual', 'WAIT-2', 'Илья Серов', 'Проверить маркировку');
const long = work(
  'waiting_accrual',
  'WAIT-LONG',
  'Очень длинное имя сотрудника для проверки переноса и автоматического роста карточки без обрезания',
  'Очень длинное название дополнительной работы, ожидающей начисления, для проверки полного многострочного отображения без горизонтального переполнения',
);
const approved = work('approved', 'APP-1', 'Анна Ким', 'Проверить комплектность');

export const P3A4_WAITING_RESPONSE = response({ waiting_accrual: [first] });
export const P3A4_WAITING_TWO_RESPONSE = response({ waiting_accrual: [first, second] });
export const P3A4_WAITING_LONG_RESPONSE = response({ waiting_accrual: [long] });
export const P3A4_WRONG_STATUS_RESPONSE = response({ approved: [approved] });

const waitingContext = Object.freeze({ additional_work_id: 'WAIT-1' });
const amountContext = Object.freeze({ additional_work_id: 'WAIT-1', amount_uzs: '12500.5' });
const longAmountContext = Object.freeze({ additional_work_id: 'WAIT-LONG', amount_uzs: '999999999999999999999.99' });
const reasonContext = Object.freeze({ additional_work_id: 'WAIT-1', without_accrual_reason: 'Работа учтена без начисления' });
const longReason = 'Очень длинный комментарий о закрытии дополнительной работы без начисления зарплаты для проверки переноса, сохранения полного текста и автоматического роста карточки';
const longReasonContext = Object.freeze({ additional_work_id: 'WAIT-LONG', without_accrual_reason: longReason });
const get = Object.freeze({ method: 'GET' as const, path: '/manager/additional-works' });
const accruePost = (id: string, amount: string) => Object.freeze({
  method: 'POST' as const,
  path: `/additional-works/${id}/accrue-salary`,
  body: Object.freeze({ amount_uzs: amount, quantity: null }),
});
const withoutPost = (id: string, reason: string) => Object.freeze({
  method: 'POST' as const,
  path: `/additional-works/${id}/mark-without-accrual`,
  body: Object.freeze({ reason }),
});

export const SECTION03_P3A4_FIXTURES = Object.freeze([
  Object.freeze({ fixtureId: 'S03-AW50:authorized', nodeId: 'S03-AW50', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze(['additional-work-waiting-accrual-card', 'additional-work-open-accrual', 'additional-work-open-without-accrual', 'additional-work-accrual-card-back']), visibleText: Object.freeze(['Сотрудник', 'Вера Юн', 'Вид работы', 'Подготовить упаковку', 'Начислить зарплату', 'Без начисления', 'Назад']), absentText: Object.freeze(['ФИО', 'S03-AW50', 'Начисленная зарплата']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['navigate0', 'navigate1', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW51', event: waitingContext }, { target: 'S03-AW53', event: waitingContext }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW50:selected-second-item', nodeId: 'S03-AW50', context: Object.freeze({ additional_work_id: 'WAIT-2' }), apiResponse: P3A4_WAITING_TWO_RESPONSE, orderedItemIds: Object.freeze(['additional-work-waiting-accrual-card', 'additional-work-open-accrual', 'additional-work-open-without-accrual', 'additional-work-accrual-card-back']), visibleText: Object.freeze(['Илья Серов', 'Проверить маркировку']), absentText: Object.freeze(['Вера Юн', 'Подготовить упаковку']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['navigate0', 'navigate1', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW51', event: { additional_work_id: 'WAIT-2' } }, { target: 'S03-AW53', event: { additional_work_id: 'WAIT-2' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW50:missing-selected-id', nodeId: 'S03-AW50', context: Object.freeze({ additional_work_id: 'WAIT-MISSING' }), apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW50:wrong-status', nodeId: 'S03-AW50', context: Object.freeze({ additional_work_id: 'APP-1' }), apiResponse: P3A4_WRONG_STATUS_RESPONSE, orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: true }),
  Object.freeze({ fixtureId: 'S03-AW50:long-content', nodeId: 'S03-AW50', context: Object.freeze({ additional_work_id: 'WAIT-LONG' }), apiResponse: P3A4_WAITING_LONG_RESPONSE, orderedItemIds: Object.freeze(['additional-work-waiting-accrual-card', 'additional-work-open-accrual', 'additional-work-open-without-accrual', 'additional-work-accrual-card-back']), visibleText: Object.freeze(['Очень длинное имя сотрудника', 'Очень длинное название дополнительной работы']), absentText: Object.freeze(['undefined', 'S03-AW50']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['navigate0', 'navigate1', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW51', event: { additional_work_id: 'WAIT-LONG' } }, { target: 'S03-AW53', event: { additional_work_id: 'WAIT-LONG' } }]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW01', pending: false, requestFailure: false, expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW51:empty', nodeId: 'S03-AW51', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '', orderedItemIds: Object.freeze(['field-amount_uzs', 'additional-work-amount-next', 'additional-work-amount-back']), visibleText: Object.freeze(['Введите сумму начисления', 'Сумма', 'Далее', 'Назад']), absentText: Object.freeze(['Сумма начисления', 'S03-AW51']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW51:malformed', nodeId: 'S03-AW51', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '12..5', orderedItemIds: Object.freeze(['field-amount_uzs', 'additional-work-amount-next', 'additional-work-amount-back']), visibleText: Object.freeze(['12..5', 'Далее']), absentText: Object.freeze(['S03-AW51']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW51:zero', nodeId: 'S03-AW51', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '0', orderedItemIds: Object.freeze(['field-amount_uzs', 'additional-work-amount-next', 'additional-work-amount-back']), visibleText: Object.freeze(['0', 'Далее']), absentText: Object.freeze(['S03-AW51']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW51:negative', nodeId: 'S03-AW51', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '-5', orderedItemIds: Object.freeze(['field-amount_uzs', 'additional-work-amount-next', 'additional-work-amount-back']), visibleText: Object.freeze(['-5', 'Далее']), absentText: Object.freeze(['S03-AW51']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW51:valid-integer', nodeId: 'S03-AW51', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '12500', orderedItemIds: Object.freeze(['field-amount_uzs', 'additional-work-amount-next', 'additional-work-amount-back']), visibleText: Object.freeze(['12500', 'Далее']), absentText: Object.freeze(['S03-AW51']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW52', event: { additional_work_id: 'WAIT-1', amount_uzs: '12500' } }]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW51:valid-decimal', nodeId: 'S03-AW51', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '12500,50', orderedItemIds: Object.freeze(['field-amount_uzs', 'additional-work-amount-next', 'additional-work-amount-back']), visibleText: Object.freeze(['12500,50', 'Далее']), absentText: Object.freeze(['S03-AW51']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW52', event: amountContext }]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW51:long-value', nodeId: 'S03-AW51', context: Object.freeze({ additional_work_id: 'WAIT-LONG' }), apiResponse: P3A4_WAITING_LONG_RESPONSE, formValue: '999999999999999999999.99', orderedItemIds: Object.freeze(['field-amount_uzs', 'additional-work-amount-next', 'additional-work-amount-back']), visibleText: Object.freeze(['999999999999999999999.99', 'Далее']), absentText: Object.freeze(['S03-AW51']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW52', event: longAmountContext }]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW52:authorized', nodeId: 'S03-AW52', context: amountContext, apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze(['additional-work-accrual-confirmation', 'additional-work-accrue', 'additional-work-accrual-confirm-back']), visibleText: Object.freeze(['Подтвердите начисление зарплаты:', 'Сотрудник', 'Вера Юн', 'Вид работы', 'Подготовить упаковку', 'Начисленная зарплата', '12501 сум', 'Назад']), absentText: Object.freeze(['12500.5 сум', 'ФИО', 'S03-AW52', 'Без начисления']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['ACCRUE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, accruePost('WAIT-1', '12500.5'), get]), backTarget: 'S03-AW51', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW52:pending-duplicate', nodeId: 'S03-AW52', context: amountContext, apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze(['additional-work-accrual-confirmation', 'additional-work-accrue', 'additional-work-accrual-confirm-back']), visibleText: Object.freeze(['Подтвердите начисление зарплаты:', '12501 сум']), absentText: Object.freeze(['12500.5 сум', 'S03-AW52']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['ACCRUE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, accruePost('WAIT-1', '12500.5'), get]), backTarget: 'S03-AW51', pending: true, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW52:request-failure', nodeId: 'S03-AW52', context: amountContext, apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze(['additional-work-accrual-confirmation', 'additional-work-accrue', 'additional-work-accrual-confirm-back']), visibleText: Object.freeze(['Подтвердите начисление зарплаты:', '12501 сум']), absentText: Object.freeze(['12500.5 сум', 'S03-AW52']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['ACCRUE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, accruePost('WAIT-1', '12500.5')]), backTarget: 'S03-AW51', pending: false, requestFailure: true, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW52:long-content', nodeId: 'S03-AW52', context: longAmountContext, apiResponse: P3A4_WAITING_LONG_RESPONSE, orderedItemIds: Object.freeze(['additional-work-accrual-confirmation', 'additional-work-accrue', 'additional-work-accrual-confirm-back']), visibleText: Object.freeze(['Очень длинное имя сотрудника', 'Очень длинное название дополнительной работы', '1000000000000000000000 сум']), absentText: Object.freeze(['999999999999999999999.99 сум', 'undefined', 'S03-AW52']), expectedStateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['ACCRUE_ADDITIONAL_WORK', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW51', pending: false, requestFailure: false, expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW53:empty', nodeId: 'S03-AW53', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '', orderedItemIds: Object.freeze(['field-without_accrual_reason', 'additional-work-reason-next', 'additional-work-reason-back']), visibleText: Object.freeze(['Комментарий', 'Далее', 'Назад']), absentText: Object.freeze(['Причина без начисления', 'S03-AW53']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW53:whitespace', nodeId: 'S03-AW53', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '   ', orderedItemIds: Object.freeze(['field-without_accrual_reason', 'additional-work-reason-next', 'additional-work-reason-back']), visibleText: Object.freeze(['Комментарий', 'Далее']), absentText: Object.freeze(['S03-AW53']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW53:valid', nodeId: 'S03-AW53', context: waitingContext, apiResponse: P3A4_WAITING_RESPONSE, formValue: '  Работа учтена без начисления  ', orderedItemIds: Object.freeze(['field-without_accrual_reason', 'additional-work-reason-next', 'additional-work-reason-back']), visibleText: Object.freeze(['Работа учтена без начисления', 'Далее']), absentText: Object.freeze(['S03-AW53']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW54', event: reasonContext }]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW53:long-reason', nodeId: 'S03-AW53', context: Object.freeze({ additional_work_id: 'WAIT-LONG' }), apiResponse: P3A4_WAITING_LONG_RESPONSE, formValue: longReason, orderedItemIds: Object.freeze(['field-without_accrual_reason', 'additional-work-reason-next', 'additional-work-reason-back']), visibleText: Object.freeze(['Очень длинный комментарий', 'Далее']), absentText: Object.freeze(['S03-AW53']), expectedStateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['navigate0', 'navigateBack0']), expectedNavigations: Object.freeze([{ target: 'S03-AW54', event: longReasonContext }]), expectedRequests: Object.freeze([]), backTarget: 'S03-AW50', pending: false, requestFailure: false, expectProjectionFailure: false }),

  Object.freeze({ fixtureId: 'S03-AW54:authorized', nodeId: 'S03-AW54', context: reasonContext, apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze(['additional-work-without-accrual-confirmation', 'additional-work-mark-without-accrual', 'additional-work-without-accrual-confirm-back']), visibleText: Object.freeze(['Подтвердите закрытие без начисления:', 'Сотрудник', 'Вера Юн', 'Вид работы', 'Подготовить упаковку', 'Комментарий', 'Работа учтена без начисления', 'Назад']), absentText: Object.freeze(['ФИО', 'S03-AW54', 'Начисленная зарплата']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['MARK_WITHOUT_ACCRUAL', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, withoutPost('WAIT-1', reasonContext.without_accrual_reason), get]), backTarget: 'S03-AW53', pending: false, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW54:pending-duplicate', nodeId: 'S03-AW54', context: reasonContext, apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze(['additional-work-without-accrual-confirmation', 'additional-work-mark-without-accrual', 'additional-work-without-accrual-confirm-back']), visibleText: Object.freeze(['Подтвердите закрытие без начисления:', 'Работа учтена без начисления']), absentText: Object.freeze(['S03-AW54']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['MARK_WITHOUT_ACCRUAL', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, withoutPost('WAIT-1', reasonContext.without_accrual_reason), get]), backTarget: 'S03-AW53', pending: true, requestFailure: false, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW54:request-failure', nodeId: 'S03-AW54', context: reasonContext, apiResponse: P3A4_WAITING_RESPONSE, orderedItemIds: Object.freeze(['additional-work-without-accrual-confirmation', 'additional-work-mark-without-accrual', 'additional-work-without-accrual-confirm-back']), visibleText: Object.freeze(['Подтвердите закрытие без начисления:', 'Работа учтена без начисления']), absentText: Object.freeze(['S03-AW54']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['MARK_WITHOUT_ACCRUAL', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get, withoutPost('WAIT-1', reasonContext.without_accrual_reason)]), backTarget: 'S03-AW53', pending: false, requestFailure: true, expectProjectionFailure: false }),
  Object.freeze({ fixtureId: 'S03-AW54:long-content', nodeId: 'S03-AW54', context: longReasonContext, apiResponse: P3A4_WAITING_LONG_RESPONSE, orderedItemIds: Object.freeze(['additional-work-without-accrual-confirmation', 'additional-work-mark-without-accrual', 'additional-work-without-accrual-confirm-back']), visibleText: Object.freeze(['Очень длинное имя сотрудника', 'Очень длинное название дополнительной работы', 'Очень длинный комментарий']), absentText: Object.freeze(['undefined', 'S03-AW54']), expectedStateKeys: Object.freeze(['state-neutral']), expectedActionIds: Object.freeze(['MARK_WITHOUT_ACCRUAL', 'navigateBack0']), expectedNavigations: Object.freeze([]), expectedRequests: Object.freeze([get]), backTarget: 'S03-AW53', pending: false, requestFailure: false, expectProjectionFailure: false }),
] as const satisfies readonly Section03P3A4Fixture[]);

export const SECTION03_P3A4_FIXTURE_IDS = Object.freeze(
  SECTION03_P3A4_FIXTURES.map((fixture) => fixture.fixtureId),
);
