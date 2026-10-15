import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';
import type { Section03P2A2aSpecializedNodeId } from '../projections/p2a2aShiftClose';

const authorizedEmployee = Object.freeze({
  employee_id: 'EMP-SHIFT-CLOSE',
  full_name: 'Петров Пётр Петрович',
  ui_state: 'shift_idle',
  ui_variant: 'light_blue',
  open_shift_id: 'SHIFT-CLOSE',
  shift_started_at: '2026-08-01T08:00:00+05:00',
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
  break_context_type: 'none',
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
  blockers: Object.freeze({
    production: null,
    break: null,
    additional_work: null,
  }),
  completed_shift_production_summary_by_sku: Object.freeze([]),
  completed_shift_additional_work_items: Object.freeze([]),
  available_actions: Object.freeze([
    'FINISH_EMPLOYEE_SHIFT_BY_MANAGER',
  ]),
});

const unauthorizedEmployee = Object.freeze({
  ...authorizedEmployee,
  employee_id: 'EMP-SHIFT-DENIED',
  full_name: 'Смирнова Светлана Сергеевна',
  open_shift_id: 'SHIFT-DENIED',
  available_actions: Object.freeze([]),
});

const longEmployee = Object.freeze({
  ...authorizedEmployee,
  employee_id: 'EMP-SHIFT-LONG',
  full_name: 'Александрова Екатерина Константиновна с очень длинным отображаемым именем сотрудника производственного участка',
  open_shift_id: 'SHIFT-LONG',
});

const cardResponse = (employee: Readonly<Record<string, unknown>>) => Object.freeze({
  section: 'S03',
  screen: 'S03-E02',
  employee,
  available_actions: Object.freeze(['BACK']),
});

const authorizedCardResponse = cardResponse(authorizedEmployee);
const unauthorizedCardResponse = cardResponse(unauthorizedEmployee);
const longCardResponse = cardResponse(longEmployee);

const validReason = 'Смена завершена по просьбе сотрудника';
const longReason = 'Смена завершается досрочно по согласованной с руководителем причине, которая намеренно сформулирована подробно для проверки переноса длинного комментария без обрезания текста и нарушения геометрии карточки подтверждения.';

export type Section03P2A2aFixture = Readonly<{
  fixtureId: string;
  nodeId: Section03P2A2aSpecializedNodeId;
  context: Section03Context;
  employeeCardResponse: Readonly<Record<string, unknown>>;
  apiResponses: Readonly<Record<string, unknown>>;
  formValue: string | null;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedActionIds: readonly string[];
  expectedBack: Section03NodeId;
  expectedNext: Section03NodeId | null;
  expectedRequest: Readonly<{
    method: 'POST';
    path: string;
    body: Readonly<{ reason: string }>;
  }> | null;
  expectedSuccessTarget: Section03NodeId | null;
  pending: boolean;
  requestFailure: boolean;
}>;

function fixture(value: Section03P2A2aFixture): Section03P2A2aFixture {
  return Object.freeze({
    ...value,
    context: Object.freeze({ ...value.context }),
    apiResponses: Object.freeze({ ...value.apiResponses }),
    orderedItemIds: Object.freeze([...value.orderedItemIds]),
    visibleText: Object.freeze([...value.visibleText]),
    absentText: Object.freeze([...value.absentText]),
    expectedActionIds: Object.freeze([...value.expectedActionIds]),
    expectedRequest: value.expectedRequest === null
      ? null
      : Object.freeze({
          ...value.expectedRequest,
          body: Object.freeze({ ...value.expectedRequest.body }),
        }),
  });
}

const api = (employeeId: string, value: unknown) => Object.freeze({
  [`/manager/employees/${employeeId}`]: value,
});

export const SECTION03_P2A2A_FIXTURES = Object.freeze([
  fixture({
    fixtureId: 'S03-E10:empty',
    nodeId: 'S03-E10',
    context: { employee_id: 'EMP-SHIFT-CLOSE' },
    employeeCardResponse: authorizedCardResponse,
    apiResponses: api('EMP-SHIFT-CLOSE', authorizedCardResponse),
    formValue: '',
    orderedItemIds: ['field-shift_finish_reason', 'shift-close-next', 'shift-close-back'],
    visibleText: ['Комментарий', 'Причина завершения смены', 'Далее', 'Назад'],
    absentText: ['Сценарий', 'S03-E10'],
    expectedActionIds: ['navigate0', 'navigateBack0'],
    expectedBack: 'S03-E02',
    expectedNext: null,
    expectedRequest: null,
    expectedSuccessTarget: null,
    pending: false,
    requestFailure: false,
  }),
  fixture({
    fixtureId: 'S03-E10:whitespace',
    nodeId: 'S03-E10',
    context: { employee_id: 'EMP-SHIFT-CLOSE' },
    employeeCardResponse: authorizedCardResponse,
    apiResponses: api('EMP-SHIFT-CLOSE', authorizedCardResponse),
    formValue: '   \n  ',
    orderedItemIds: ['field-shift_finish_reason', 'shift-close-next', 'shift-close-back'],
    visibleText: ['Комментарий', 'Причина завершения смены', 'Далее', 'Назад'],
    absentText: ['Сценарий', 'S03-E10'],
    expectedActionIds: ['navigate0', 'navigateBack0'],
    expectedBack: 'S03-E02',
    expectedNext: null,
    expectedRequest: null,
    expectedSuccessTarget: null,
    pending: false,
    requestFailure: false,
  }),
  fixture({
    fixtureId: 'S03-E10:valid',
    nodeId: 'S03-E10',
    context: { employee_id: 'EMP-SHIFT-CLOSE' },
    employeeCardResponse: authorizedCardResponse,
    apiResponses: api('EMP-SHIFT-CLOSE', authorizedCardResponse),
    formValue: `  ${validReason}  `,
    orderedItemIds: ['field-shift_finish_reason', 'shift-close-next', 'shift-close-back'],
    visibleText: ['Комментарий', 'Причина завершения смены', 'Далее', 'Назад'],
    absentText: ['Сценарий', 'S03-E10'],
    expectedActionIds: ['navigate0', 'navigateBack0'],
    expectedBack: 'S03-E02',
    expectedNext: 'S03-E11',
    expectedRequest: null,
    expectedSuccessTarget: null,
    pending: false,
    requestFailure: false,
  }),
  fixture({
    fixtureId: 'S03-E10:long-reason',
    nodeId: 'S03-E10',
    context: { employee_id: 'EMP-SHIFT-CLOSE' },
    employeeCardResponse: authorizedCardResponse,
    apiResponses: api('EMP-SHIFT-CLOSE', authorizedCardResponse),
    formValue: longReason,
    orderedItemIds: ['field-shift_finish_reason', 'shift-close-next', 'shift-close-back'],
    visibleText: ['Комментарий', 'Причина завершения смены', 'Далее', 'Назад'],
    absentText: ['Сценарий', 'S03-E10'],
    expectedActionIds: ['navigate0', 'navigateBack0'],
    expectedBack: 'S03-E02',
    expectedNext: 'S03-E11',
    expectedRequest: null,
    expectedSuccessTarget: null,
    pending: false,
    requestFailure: false,
  }),
  fixture({
    fixtureId: 'S03-E11:valid-authorized',
    nodeId: 'S03-E11',
    context: { employee_id: 'EMP-SHIFT-CLOSE', shift_finish_reason: validReason },
    employeeCardResponse: authorizedCardResponse,
    apiResponses: api('EMP-SHIFT-CLOSE', authorizedCardResponse),
    formValue: null,
    orderedItemIds: ['shift-close-confirmation', 'shift-close-confirm', 'shift-close-confirmation-back'],
    visibleText: ['Подтвердите завершение смены:', 'Сотрудник', 'Петров Пётр Петрович', 'Комментарий', validReason, 'Завершить смену\\nПетров Пётр Петрович', 'Назад'],
    absentText: ['Сценарий', 'S03-E11'],
    expectedActionIds: ['CLOSE_EMPLOYEE_SHIFT', 'navigateBack0'],
    expectedBack: 'S03-E10',
    expectedNext: null,
    expectedRequest: { method: 'POST', path: '/shifts/EMP-SHIFT-CLOSE/emergency-close', body: { reason: validReason } },
    expectedSuccessTarget: 'S03-E01',
    pending: false,
    requestFailure: false,
  }),
  fixture({
    fixtureId: 'S03-E11:unauthorized',
    nodeId: 'S03-E11',
    context: { employee_id: 'EMP-SHIFT-DENIED', shift_finish_reason: validReason },
    employeeCardResponse: unauthorizedCardResponse,
    apiResponses: api('EMP-SHIFT-DENIED', unauthorizedCardResponse),
    formValue: null,
    orderedItemIds: ['shift-close-confirmation', 'shift-close-confirm', 'shift-close-confirmation-back'],
    visibleText: ['Подтвердите завершение смены:', 'Сотрудник', 'Смирнова Светлана Сергеевна', 'Комментарий', validReason, 'Завершить смену\\nСмирнова Светлана Сергеевна', 'Назад'],
    absentText: ['Сценарий', 'S03-E11'],
    expectedActionIds: ['navigateBack0'],
    expectedBack: 'S03-E10',
    expectedNext: null,
    expectedRequest: null,
    expectedSuccessTarget: null,
    pending: false,
    requestFailure: false,
  }),
  fixture({
    fixtureId: 'S03-E11:pending-duplicate',
    nodeId: 'S03-E11',
    context: { employee_id: 'EMP-SHIFT-CLOSE', shift_finish_reason: validReason },
    employeeCardResponse: authorizedCardResponse,
    apiResponses: api('EMP-SHIFT-CLOSE', authorizedCardResponse),
    formValue: null,
    orderedItemIds: ['shift-close-confirmation', 'shift-close-confirm', 'shift-close-confirmation-back'],
    visibleText: ['Подтвердите завершение смены:', 'Петров Пётр Петрович', validReason, 'Завершить смену\\nПетров Пётр Петрович'],
    absentText: ['Сценарий', 'S03-E11'],
    expectedActionIds: ['CLOSE_EMPLOYEE_SHIFT', 'navigateBack0'],
    expectedBack: 'S03-E10',
    expectedNext: null,
    expectedRequest: { method: 'POST', path: '/shifts/EMP-SHIFT-CLOSE/emergency-close', body: { reason: validReason } },
    expectedSuccessTarget: 'S03-E01',
    pending: true,
    requestFailure: false,
  }),
  fixture({
    fixtureId: 'S03-E11:request-failure',
    nodeId: 'S03-E11',
    context: { employee_id: 'EMP-SHIFT-CLOSE', shift_finish_reason: validReason },
    employeeCardResponse: authorizedCardResponse,
    apiResponses: api('EMP-SHIFT-CLOSE', authorizedCardResponse),
    formValue: null,
    orderedItemIds: ['shift-close-confirmation', 'shift-close-confirm', 'shift-close-confirmation-back'],
    visibleText: ['Подтвердите завершение смены:', 'Петров Пётр Петрович', validReason, 'Завершить смену\\nПетров Пётр Петрович'],
    absentText: ['Сценарий', 'S03-E11'],
    expectedActionIds: ['CLOSE_EMPLOYEE_SHIFT', 'navigateBack0'],
    expectedBack: 'S03-E10',
    expectedNext: null,
    expectedRequest: { method: 'POST', path: '/shifts/EMP-SHIFT-CLOSE/emergency-close', body: { reason: validReason } },
    expectedSuccessTarget: null,
    pending: false,
    requestFailure: true,
  }),
  fixture({
    fixtureId: 'S03-E11:long-name-and-reason',
    nodeId: 'S03-E11',
    context: { employee_id: 'EMP-SHIFT-LONG', shift_finish_reason: longReason },
    employeeCardResponse: longCardResponse,
    apiResponses: api('EMP-SHIFT-LONG', longCardResponse),
    formValue: null,
    orderedItemIds: ['shift-close-confirmation', 'shift-close-confirm', 'shift-close-confirmation-back'],
    visibleText: ['Подтвердите завершение смены:', 'Александрова Екатерина Константиновна', longReason, 'Назад'],
    absentText: ['Сценарий', 'S03-E11'],
    expectedActionIds: ['CLOSE_EMPLOYEE_SHIFT', 'navigateBack0'],
    expectedBack: 'S03-E10',
    expectedNext: null,
    expectedRequest: { method: 'POST', path: '/shifts/EMP-SHIFT-LONG/emergency-close', body: { reason: longReason } },
    expectedSuccessTarget: 'S03-E01',
    pending: false,
    requestFailure: false,
  }),
] as const);

export const SECTION03_P2A2A_FIXTURE_IDS = Object.freeze(
  SECTION03_P2A2A_FIXTURES.map((value) => value.fixtureId),
);
