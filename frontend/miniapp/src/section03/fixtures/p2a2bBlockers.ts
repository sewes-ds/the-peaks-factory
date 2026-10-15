import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';
import type { Section03P2A2bSpecializedNodeId } from '../projections/p2a2bBlockers';

const technicalComment = 'Завершено начальником производства при завершении смены сотрудника';
const noBlockers = Object.freeze({ production: null, break: null, additional_work: null });
const production = Object.freeze({
  production_operation_id: 'PO-BLOCK', machine_id: 'M-BLOCK',
  machine_name: 'Станок блокирующего производства', sku_name: 'Корпус редуктора',
});
const breakBlocker = Object.freeze({ target_employee_id: 'EMP-BLOCK', operator_break_id: 'BREAK-BLOCK' });
const additionalWork = Object.freeze({ additional_work_id: 'AW-BLOCK' });

const employee = (
  blockers: Readonly<Record<string, unknown>>,
  fullName = 'Петров Пётр Петрович',
) => Object.freeze({
  employee_id: 'EMP-BLOCK', full_name: fullName, ui_state: 'shift_idle', ui_variant: 'light_blue',
  open_shift_id: 'SHIFT-BLOCK', shift_started_at: '2026-08-01T08:00:00+05:00',
  active_production_operation_id: null, production_started_at: null,
  active_machine_id: null, active_machine_name: null, active_sku_id: null,
  active_sku_code: null, active_sku_name: null, active_break_id: null,
  active_break_name: null, break_started_at: null, break_duration: null,
  active_downtime_id: null, downtime_type: null, downtime_name: null,
  downtime_comment: null, downtime_started_at: null, downtime_duration: null,
  downtime_start_comment: null, downtime_finish_comment: null,
  active_additional_work_id: null, active_additional_work_name: null,
  additional_work_started_at: null, additional_work_duration: null,
  blockers, available_actions: Object.freeze(['VIEW_SALARY', 'VIEW_COMPLETED_WORKS']),
});
const card = (blockers: Readonly<Record<string, unknown>>, fullName?: string) => Object.freeze({
  section: 'S03', screen: 'S03-E02', employee: employee(blockers, fullName),
  available_actions: Object.freeze(['BACK']),
});

export const P2A2B_CARD_ALL = card(Object.freeze({ production, break: breakBlocker, additional_work: additionalWork }));
export const P2A2B_CARD_PRODUCTION = card(Object.freeze({ production, break: null, additional_work: null }));
export const P2A2B_CARD_BREAK = card(Object.freeze({ production: null, break: breakBlocker, additional_work: null }));
export const P2A2B_CARD_ADDITIONAL_WORK = card(Object.freeze({ production: null, break: null, additional_work: additionalWork }));
export const P2A2B_CARD_NONE = card(noBlockers);
const productionNullDetails = card(Object.freeze({
  production: Object.freeze({ ...production, machine_id: null, machine_name: null, sku_name: null }),
  break: null, additional_work: null,
}));
const productionMismatch = card(Object.freeze({
  production: Object.freeze({ ...production, production_operation_id: 'PO-OTHER' }),
  break: null, additional_work: null,
}));
const additionalWorkMismatch = card(Object.freeze({
  production: null, break: null,
  additional_work: Object.freeze({ additional_work_id: 'AW-OTHER' }),
}));
const longName = 'Александрова Екатерина Константиновна с очень длинным отображаемым именем сотрудника производственного участка';
const longProduction = card(Object.freeze({
  production: Object.freeze({ ...production,
    machine_name: 'Токарно-фрезерный обрабатывающий центр производственной линии с очень длинным наименованием',
    sku_name: 'Корпус редуктора специального исполнения с очень длинным наименованием номенклатуры',
  }), break: null, additional_work: null,
}), longName);

type ExpectedRequest = Readonly<{
  method: 'POST'; path: string; body: Readonly<Record<string, string>>;
}>;

export type Section03P2A2bFixture = Readonly<{
  fixtureId: string;
  nodeId: Section03P2A2bSpecializedNodeId;
  context: Section03Context;
  initialResponse: Readonly<Record<string, unknown>>;
  freshResponse: unknown;
  formValue: string | null;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedActionIds: readonly string[];
  expectedBack: Section03NodeId;
  expectedNext: Section03NodeId | null;
  expectedRequest: ExpectedRequest | null;
  expectedOutcomeTarget: Section03NodeId | null;
  pending: boolean;
  requestFailure: boolean;
  invalidFresh: boolean;
}>;

function fixture(value: Section03P2A2bFixture): Section03P2A2bFixture {
  return Object.freeze({
    ...value, context: Object.freeze({ ...value.context }),
    orderedItemIds: Object.freeze([...value.orderedItemIds]),
    visibleText: Object.freeze([...value.visibleText]), absentText: Object.freeze([...value.absentText]),
    expectedActionIds: Object.freeze([...value.expectedActionIds]),
    expectedRequest: value.expectedRequest === null ? null : Object.freeze({
      ...value.expectedRequest, body: Object.freeze({ ...value.expectedRequest.body }),
    }),
  });
}

const formItems = ['field-quantity_produced', 'production-quantity-next', 'production-quantity-back'];
const formVisible = ['Введите количество сделанной продукции', 'Количество', 'Далее', 'Назад'];
const prodItems = ['production-finish-card', 'production-finish-confirm', 'production-finish-back'];
const prodDeniedItems = prodItems;
const prodVisible = ['Подтвердите завершение производства:', 'Сотрудник', 'Петров Пётр Петрович', 'Станок', 'Станок блокирующего производства', 'SKU', 'Корпус редуктора', 'Количество', '13', 'Завершить производство', 'Назад'];
const breakItems = ['break-finish-card', 'break-finish-confirm', 'break-finish-back'];
const breakDeniedItems = breakItems;
const breakVisible = ['Подтвердите завершение перерыва:', 'Сотрудник', 'Петров Пётр Петрович', 'Завершить перерыв', 'Назад'];
const awItems = ['additional-work-finish-card', 'additional-work-finish-confirm', 'additional-work-finish-back'];
const awDeniedItems = awItems;
const awVisible = ['Подтвердите завершение доп. работы:', 'Сотрудник', 'Петров Пётр Петрович', 'Завершить доп. работу', 'Назад'];
const absentTechnical = ['Сценарий', 'S03-E13', 'S03-E14', 'S03-E16', 'S03-E17'];
const productionRequest: ExpectedRequest = Object.freeze({
  method: 'POST', path: '/production-operations/PO-BLOCK/finish',
  body: Object.freeze({ quantity_produced: '12.5', comment: technicalComment }),
});
const breakRequest: ExpectedRequest = Object.freeze({
  method: 'POST', path: '/operator-breaks/EMP-BLOCK/emergency-finish',
  body: Object.freeze({ reason: technicalComment }),
});
const additionalWorkRequest: ExpectedRequest = Object.freeze({
  method: 'POST', path: '/additional-works/AW-BLOCK/finish',
  body: Object.freeze({ comment: technicalComment }),
});

export const SECTION03_P2A2B_FIXTURES = Object.freeze([
  fixture({ fixtureId: 'S03-E13:empty', nodeId: 'S03-E13', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_PRODUCTION, formValue: '', orderedItemIds: formItems, visibleText: formVisible, absentText: absentTechnical, expectedActionIds: ['navigate0', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E13:malformed', nodeId: 'S03-E13', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_PRODUCTION, formValue: 'не число', orderedItemIds: formItems, visibleText: formVisible, absentText: absentTechnical, expectedActionIds: ['navigate0', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E13:zero', nodeId: 'S03-E13', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_PRODUCTION, formValue: '0', orderedItemIds: formItems, visibleText: formVisible, absentText: absentTechnical, expectedActionIds: ['navigate0', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E13:negative', nodeId: 'S03-E13', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_PRODUCTION, formValue: '-3', orderedItemIds: formItems, visibleText: formVisible, absentText: absentTechnical, expectedActionIds: ['navigate0', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E13:valid-integer', nodeId: 'S03-E13', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_PRODUCTION, formValue: '12', orderedItemIds: formItems, visibleText: formVisible, absentText: absentTechnical, expectedActionIds: ['navigate0', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: 'S03-E14', expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E13:valid-decimal', nodeId: 'S03-E13', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_PRODUCTION, formValue: '12.5000', orderedItemIds: formItems, visibleText: formVisible, absentText: absentTechnical, expectedActionIds: ['navigate0', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: 'S03-E14', expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E13:long-value', nodeId: 'S03-E13', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_PRODUCTION, formValue: '12345678901234567890.123456789', orderedItemIds: formItems, visibleText: formVisible, absentText: absentTechnical, expectedActionIds: ['navigate0', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: 'S03-E14', expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),

  fixture({ fixtureId: 'S03-E14:valid-blockers-remain', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: P2A2B_CARD_ALL, freshResponse: P2A2B_CARD_BREAK, formValue: null, orderedItemIds: prodItems, visibleText: prodVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_PRODUCTION_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: productionRequest, expectedOutcomeTarget: 'S03-E12', pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E14:valid-last-blocker', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: prodItems, visibleText: prodVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_PRODUCTION_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: productionRequest, expectedOutcomeTarget: 'S03-E10', pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E14:pending-duplicate', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: prodItems, visibleText: prodVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_PRODUCTION_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: productionRequest, expectedOutcomeTarget: 'S03-E10', pending: true, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E14:request-failure', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: prodItems, visibleText: prodVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_PRODUCTION_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: productionRequest, expectedOutcomeTarget: null, pending: false, requestFailure: true, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E14:fresh-response-invalid', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: P2A2B_CARD_PRODUCTION, freshResponse: Object.freeze({ unrelated: Object.freeze({ required_finish_pipeline: Object.freeze(['fake']) }) }), formValue: null, orderedItemIds: prodItems, visibleText: prodVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_PRODUCTION_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: productionRequest, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: true }),
  fixture({ fixtureId: 'S03-E14:blocker-absent', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: P2A2B_CARD_NONE, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: prodDeniedItems, visibleText: ['Подтвердите завершение производства:', 'Сотрудник', 'Количество', '13', 'Завершить производство', 'Назад'], absentText: absentTechnical, expectedActionIds: ['navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E14:operation-id-mismatch', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: productionMismatch, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: prodDeniedItems, visibleText: ['Подтвердите завершение производства:', 'Сотрудник', 'Количество', '13', 'Завершить производство', 'Назад'], absentText: absentTechnical, expectedActionIds: ['navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E14:null-machine-and-sku', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' }, initialResponse: productionNullDetails, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: prodItems, visibleText: ['Подтвердите завершение производства:', 'Сотрудник', 'Количество', '13', 'Завершить производство', 'Назад'], absentText: [...absentTechnical, 'Станок', 'SKU'], expectedActionIds: ['FINISH_PRODUCTION_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: productionRequest, expectedOutcomeTarget: 'S03-E10', pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E14:long-content', nodeId: 'S03-E14', context: { employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12345678901234567890.123456789' }, initialResponse: longProduction, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: prodItems, visibleText: [longName, 'Токарно-фрезерный обрабатывающий центр', 'Корпус редуктора специального исполнения', '12345678901234567890'], absentText: absentTechnical, expectedActionIds: ['FINISH_PRODUCTION_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E13', expectedNext: null, expectedRequest: Object.freeze({ ...productionRequest, body: Object.freeze({ ...productionRequest.body, quantity_produced: '12345678901234567890.123456789' }) }), expectedOutcomeTarget: 'S03-E10', pending: false, requestFailure: false, invalidFresh: false }),

  fixture({ fixtureId: 'S03-E16:valid-blockers-remain', nodeId: 'S03-E16', context: { employee_id: 'EMP-BLOCK' }, initialResponse: P2A2B_CARD_ALL, freshResponse: P2A2B_CARD_ADDITIONAL_WORK, formValue: null, orderedItemIds: breakItems, visibleText: breakVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_BREAK_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: breakRequest, expectedOutcomeTarget: 'S03-E12', pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E16:valid-last-blocker', nodeId: 'S03-E16', context: { employee_id: 'EMP-BLOCK' }, initialResponse: P2A2B_CARD_BREAK, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: breakItems, visibleText: breakVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_BREAK_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: breakRequest, expectedOutcomeTarget: 'S03-E10', pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E16:pending-duplicate', nodeId: 'S03-E16', context: { employee_id: 'EMP-BLOCK' }, initialResponse: P2A2B_CARD_BREAK, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: breakItems, visibleText: breakVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_BREAK_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: breakRequest, expectedOutcomeTarget: 'S03-E10', pending: true, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E16:request-failure', nodeId: 'S03-E16', context: { employee_id: 'EMP-BLOCK' }, initialResponse: P2A2B_CARD_BREAK, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: breakItems, visibleText: breakVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_BREAK_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: breakRequest, expectedOutcomeTarget: null, pending: false, requestFailure: true, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E16:blocker-absent', nodeId: 'S03-E16', context: { employee_id: 'EMP-BLOCK' }, initialResponse: P2A2B_CARD_NONE, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: breakDeniedItems, visibleText: ['Подтвердите завершение перерыва:', 'Сотрудник', 'Завершить перерыв', 'Назад'], absentText: absentTechnical, expectedActionIds: ['navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E16:long-name', nodeId: 'S03-E16', context: { employee_id: 'EMP-BLOCK' }, initialResponse: card(Object.freeze({ production: null, break: breakBlocker, additional_work: null }), longName), freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: breakItems, visibleText: [longName, 'Завершить перерыв', 'Назад'], absentText: absentTechnical, expectedActionIds: ['FINISH_BREAK_BLOCKER', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: breakRequest, expectedOutcomeTarget: 'S03-E10', pending: false, requestFailure: false, invalidFresh: false }),

  fixture({ fixtureId: 'S03-E17:valid-blockers-remain', nodeId: 'S03-E17', context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' }, initialResponse: P2A2B_CARD_ALL, freshResponse: P2A2B_CARD_PRODUCTION, formValue: null, orderedItemIds: awItems, visibleText: awVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_ADDITIONAL_WORK', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: additionalWorkRequest, expectedOutcomeTarget: 'S03-E12', pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E17:valid-last-blocker', nodeId: 'S03-E17', context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' }, initialResponse: P2A2B_CARD_ADDITIONAL_WORK, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: awItems, visibleText: awVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_ADDITIONAL_WORK', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: additionalWorkRequest, expectedOutcomeTarget: 'S03-E10', pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E17:pending-duplicate', nodeId: 'S03-E17', context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' }, initialResponse: P2A2B_CARD_ADDITIONAL_WORK, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: awItems, visibleText: awVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_ADDITIONAL_WORK', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: additionalWorkRequest, expectedOutcomeTarget: 'S03-E10', pending: true, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E17:request-failure', nodeId: 'S03-E17', context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' }, initialResponse: P2A2B_CARD_ADDITIONAL_WORK, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: awItems, visibleText: awVisible, absentText: absentTechnical, expectedActionIds: ['FINISH_ADDITIONAL_WORK', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: additionalWorkRequest, expectedOutcomeTarget: null, pending: false, requestFailure: true, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E17:blocker-absent', nodeId: 'S03-E17', context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' }, initialResponse: P2A2B_CARD_NONE, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: awDeniedItems, visibleText: ['Подтвердите завершение доп. работы:', 'Сотрудник', 'Завершить доп. работу', 'Назад'], absentText: absentTechnical, expectedActionIds: ['navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E17:id-mismatch', nodeId: 'S03-E17', context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' }, initialResponse: additionalWorkMismatch, freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: awDeniedItems, visibleText: ['Подтвердите завершение доп. работы:', 'Сотрудник', 'Завершить доп. работу', 'Назад'], absentText: absentTechnical, expectedActionIds: ['navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: null, expectedOutcomeTarget: null, pending: false, requestFailure: false, invalidFresh: false }),
  fixture({ fixtureId: 'S03-E17:long-name', nodeId: 'S03-E17', context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' }, initialResponse: card(Object.freeze({ production: null, break: null, additional_work: additionalWork }), longName), freshResponse: P2A2B_CARD_NONE, formValue: null, orderedItemIds: awItems, visibleText: [longName, 'Завершить доп. работу', 'Назад'], absentText: absentTechnical, expectedActionIds: ['FINISH_ADDITIONAL_WORK', 'navigateBack0'], expectedBack: 'S03-E12', expectedNext: null, expectedRequest: additionalWorkRequest, expectedOutcomeTarget: 'S03-E10', pending: false, requestFailure: false, invalidFresh: false }),
] as const);

export const SECTION03_P2A2B_FIXTURE_IDS = Object.freeze(
  SECTION03_P2A2B_FIXTURES.map((item) => item.fixtureId),
);
