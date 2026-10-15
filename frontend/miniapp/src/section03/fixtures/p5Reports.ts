import type { ManagerWorkplaceState } from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';
import { P4A2_WORKPLACE_AUTHORIZED_RESPONSE } from './p4a2FinancialCorrectionCreate';

export type Section03P5Fixture = Readonly<{
  fixtureId: string;
  nodeId: Extract<Section03NodeId, `S03-R${string}`>;
  context: Section03Context;
  nowEpochMs: number | null;
  formValue: string | null;
  formPending: boolean;
  workplaceResponse: ManagerWorkplaceState | null;
  exportResponse: unknown;
  mutationOutcome: 'none' | 'success' | 'pending-duplicate' | 'request-failure' | 'malformed-response';
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedControlKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedEvents: readonly Readonly<Record<string, string>>[];
  expectedBackTarget: Section03NodeId | null;
  expectedPostBody: Readonly<Record<string, string>> | null;
  expectProjectionFailure: boolean;
}>;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const P5_REPORTS_AUTHORIZED_RESPONSE = deepFreeze(
  structuredClone(P4A2_WORKPLACE_AUTHORIZED_RESPONSE) as ManagerWorkplaceState,
);

export const P5_REPORTS_UNAUTHORIZED_RESPONSE = deepFreeze({
  ...structuredClone(P5_REPORTS_AUTHORIZED_RESPONSE),
  sections: {
    ...structuredClone(P5_REPORTS_AUTHORIZED_RESPONSE.sections),
    reports: {
      ...structuredClone(P5_REPORTS_AUTHORIZED_RESPONSE.sections.reports),
      available_actions: [],
    },
  },
}) as ManagerWorkplaceState;

export const P5_REPORTS_UNRELATED_AUTHORITY_RESPONSE = deepFreeze({
  ...structuredClone(P5_REPORTS_UNAUTHORIZED_RESPONSE),
  sections: {
    ...structuredClone(P5_REPORTS_UNAUTHORIZED_RESPONSE.sections),
    corrections: {
      ...structuredClone(P5_REPORTS_UNAUTHORIZED_RESPONSE.sections.corrections),
      available_actions: ['OPEN_REPORTS'],
    },
  },
}) as ManagerWorkplaceState;

export const P5_EXPORT_SUCCESS_RESPONSE = deepFreeze({ export_run_id: '42' });
export const P5_EXPORT_FALLBACK_ID_RESPONSE = deepFreeze({ id: '42' });
export const P5_EXPORT_RUN_ID_RESPONSE = deepFreeze({ run_id: '42' });
export const P5_EXPORT_OPERATION_ID_RESPONSE = deepFreeze({ operation_id: '42' });
export const P5_EXPORT_EXTRA_FIELD_RESPONSE = deepFreeze({ export_run_id: '42', extra: true });
export const P5_EXPORT_MISSING_ID_RESPONSE = deepFreeze({});

const empty = Object.freeze([]) as readonly string[];
const emptyEvents = Object.freeze([]) as readonly Readonly<Record<string, string>>[];
const reportRange = deepFreeze({ from_date: '2026-08-01', to_date: '2026-08-04' });

function fixture(input: Partial<Section03P5Fixture> & Pick<Section03P5Fixture, 'fixtureId' | 'nodeId'>): Section03P5Fixture {
  return deepFreeze({
    context: {}, nowEpochMs: null, formValue: null, formPending: false,
    workplaceResponse: null, exportResponse: P5_EXPORT_SUCCESS_RESPONSE, mutationOutcome: 'none',
    orderedItemIds: empty, visibleText: empty, expectedStateKeys: empty,
    expectedControlKeys: empty, expectedActionIds: empty, expectedEvents: emptyEvents,
    expectedBackTarget: null, expectedPostBody: null, expectProjectionFailure: false,
    ...input,
  });
}

const menu = fixture({
  fixtureId: 'S03-R01:menu', nodeId: 'S03-R01',
  orderedItemIds: ['reports-google-sheets', 'reports-menu-back'], visibleText: ['Отчёты', 'Выгрузка в Google Таблицы', 'Назад'],
  expectedControlKeys: ['navigation-open', 'navigation-back'], expectedActionIds: ['navigate0', 'navigateBack0'], expectedEvents: [{}, {}], expectedBackTarget: 'S03-N01',
});

const r10 = (suffix: string, nowEpochMs: number) => fixture({
  fixtureId: `S03-R10:${suffix}`, nodeId: 'S03-R10', nowEpochMs,
  orderedItemIds: ['reports-period-today', 'reports-period-week', 'reports-period-month', 'reports-period-last-30-days', 'reports-period-custom', 'reports-period-back'],
  visibleText: ['Выберите период выгрузки', 'За сегодня', 'За неделю', 'За месяц', 'Последние 30 дней', 'Выбрать период вручную', 'Назад'],
  expectedControlKeys: ['selection-primary', 'selection-primary', 'selection-primary', 'selection-primary', 'selection-secondary', 'navigation-back'],
  expectedActionIds: ['navigate1', 'navigate1', 'navigate1', 'navigate1', 'navigate0', 'navigateBack0'], expectedBackTarget: 'S03-R01',
});

const r11 = (suffix: string, formValue: string, formPending = false) => fixture({
  fixtureId: `S03-R11:${suffix}`, nodeId: 'S03-R11', formValue, formPending,
  orderedItemIds: ['field-from_date', 'reports-start-date-next', 'reports-start-date-back'], visibleText: ['Дата начала', formValue === '2026-8-01' || formValue === '2026-02-29' ? '' : formValue, 'Далее', 'Назад'].filter(Boolean),
  expectedControlKeys: ['navigation-next', 'navigation-back'], expectedActionIds: ['navigate0', 'navigateBack0'], expectedBackTarget: 'S03-R10',
});

const r12 = (suffix: string, fromDate: string, formValue: string, formPending = false, failure = false) => fixture({
  fixtureId: `S03-R12:${suffix}`, nodeId: 'S03-R12', context: { from_date: fromDate }, formValue, formPending,
  orderedItemIds: failure ? [] : ['field-to_date', 'reports-end-date-next', 'reports-end-date-back'], visibleText: failure ? [] : ['Дата окончания', formValue === '2026-8-04' ? '' : formValue, 'Далее', 'Назад'].filter(Boolean),
  expectedControlKeys: failure ? [] : ['navigation-next', 'navigation-back'], expectedActionIds: failure ? [] : ['navigate0', 'navigateBack0'], expectedEvents: failure ? [] : [{ from_date: fromDate, ...(formValue ? { to_date: formValue } : {}) }, { from_date: fromDate }], expectedBackTarget: 'S03-R11', expectProjectionFailure: failure,
});

const r13 = (
  suffix: string,
  context: Section03Context,
  workplaceResponse: ManagerWorkplaceState | null,
  options: Partial<Section03P5Fixture> = {},
) => fixture({
  fixtureId: `S03-R13:${suffix}`, nodeId: 'S03-R13', context, workplaceResponse,
  orderedItemIds: ['reports-export-authority-denied', 'reports-export-confirm-back'],
  visibleText: ['Недостаточно прав для создания выгрузки.', 'Назад'],
  expectedStateKeys: ['state-info'], expectedControlKeys: ['navigation-back'],
  expectedActionIds: [context.period === undefined ? 'navigateBack1' : 'navigateBack0'],
  expectedEvents: [context.period === undefined ? { from_date: context.from_date ?? '', to_date: context.to_date ?? '' } : {}],
  expectedPostBody: null,
  ...options,
});

const authorityDenied: Partial<Section03P5Fixture> = deepFreeze({
  expectedBackTarget: 'S03-R12',
});

const r14 = (suffix: string, exportRunId: string, failure = false) => fixture({
  fixtureId: `S03-R14:${suffix}`, nodeId: 'S03-R14', context: { export_run_id: exportRunId },
  orderedItemIds: failure ? [] : ['reports-export-created', 'reports-export-home'],
  visibleText: failure ? [] : ['Заявка на выгрузку создана.', `Export run: ${exportRunId}`, 'На главный экран'],
  expectedStateKeys: failure ? [] : ['state-positive'], expectedControlKeys: failure ? [] : ['navigation-open'], expectedActionIds: failure ? [] : ['navigate0'], expectedEvents: failure ? [] : [{}],
  expectProjectionFailure: failure,
});

const predefinedRange = deepFreeze({ period: 'today' as const, from_date: '2026-08-04', to_date: '2026-08-04' });

const fixtures = [
  menu,
  r10('today', Date.parse('2026-08-04T08:00:00Z')),
  r10('week-monday', Date.parse('2026-08-03T08:00:00Z')),
  r10('week-sunday', Date.parse('2026-08-09T08:00:00Z')),
  r10('month-boundary', Date.parse('2027-01-01T08:00:00Z')),
  r10('last-30-days', Date.parse('2026-08-04T08:00:00Z')),
  r10('utc-tashkent-boundary', Date.parse('2026-08-03T20:30:00Z')),
  r10('custom-choice', Date.parse('2026-08-04T08:00:00Z')),
  r11('empty', ''), r11('malformed', '2026-8-01'), r11('impossible-date', '2026-02-29'),
  r11('valid', '2026-08-01'), r11('leap-day', '2028-02-29'), r11('pending', '2026-08-01', true),
  r12('empty', '2026-08-01', ''), r12('malformed', '2026-08-01', '2026-8-04'),
  r12('before-from-date', '2026-08-04', '2026-08-03'), r12('equal-date', '2026-08-04', '2026-08-04'),
  r12('valid-later-date', '2026-08-01', '2026-08-04'), r12('back-restoration', '2026-08-01', '2026-08-04'),
  r12('pending', '2026-08-01', '2026-08-04', true), r12('invalid-incoming-from-date', '2026-02-29', '2026-08-04', false, true),
  r13('predefined-today-authorized', predefinedRange, P5_REPORTS_AUTHORIZED_RESPONSE, { expectedBackTarget: 'S03-R10' }),
  r13('predefined-week-authorized', { period: 'week', from_date: '2026-08-03', to_date: '2026-08-09' }, P5_REPORTS_AUTHORIZED_RESPONSE, { expectedBackTarget: 'S03-R10' }),
  r13('custom-authorized', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { expectedBackTarget: 'S03-R12', mutationOutcome: 'success' }),
  r13('pending-duplicate', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { expectedBackTarget: 'S03-R12', mutationOutcome: 'pending-duplicate' }),
  r13('post-failure', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { expectedBackTarget: 'S03-R12', mutationOutcome: 'request-failure' }),
  r13('long-range-content', { from_date: '2000-01-01', to_date: '9999-12-31' }, P5_REPORTS_AUTHORIZED_RESPONSE, { expectedBackTarget: 'S03-R12' }),
  r13('missing-reports-authority', reportRange, P5_REPORTS_UNAUTHORIZED_RESPONSE, authorityDenied),
  r13('unrelated-nested-open-reports-only', reportRange, P5_REPORTS_UNRELATED_AUTHORITY_RESPONSE, authorityDenied),
  r13('missing-primary', reportRange, null, { expectProjectionFailure: true, orderedItemIds: [], visibleText: [], expectedStateKeys: [], expectedControlKeys: [], expectedActionIds: [], expectedEvents: [] }),
  r13('period-only-context', { period: 'today' }, P5_REPORTS_AUTHORIZED_RESPONSE, { expectProjectionFailure: true, orderedItemIds: [], visibleText: [], expectedStateKeys: [], expectedControlKeys: [], expectedActionIds: [], expectedEvents: [] }),
  r13('missing-one-date', { from_date: '2026-08-01' }, P5_REPORTS_AUTHORIZED_RESPONSE, { expectProjectionFailure: true, orderedItemIds: [], visibleText: [], expectedStateKeys: [], expectedControlKeys: [], expectedActionIds: [], expectedEvents: [] }),
  r13('malformed-date', { from_date: '2026-8-01', to_date: '2026-08-04' }, P5_REPORTS_AUTHORIZED_RESPONSE, { expectProjectionFailure: true, orderedItemIds: [], visibleText: [], expectedStateKeys: [], expectedControlKeys: [], expectedActionIds: [], expectedEvents: [] }),
  r13('reversed-range', { from_date: '2026-08-05', to_date: '2026-08-04' }, P5_REPORTS_AUTHORIZED_RESPONSE, { expectProjectionFailure: true, orderedItemIds: [], visibleText: [], expectedStateKeys: [], expectedControlKeys: [], expectedActionIds: [], expectedEvents: [] }),
  r13('business-action-denied', reportRange, P5_REPORTS_UNAUTHORIZED_RESPONSE, authorityDenied),
  r14('valid-export-id', '42'), r14('long-valid-export-id', '123456789012345678901234567890'),
  r14('missing-id', '', true), r14('zero', '0', true), r14('malformed-id', 'EXPORT-1', true),
  r13('mutation-fallback-id', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { exportResponse: P5_EXPORT_FALLBACK_ID_RESPONSE, mutationOutcome: 'malformed-response', expectedBackTarget: 'S03-R12' }),
  r13('mutation-run-id', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { exportResponse: P5_EXPORT_RUN_ID_RESPONSE, mutationOutcome: 'malformed-response', expectedBackTarget: 'S03-R12' }),
  r13('mutation-operation-id', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { exportResponse: P5_EXPORT_OPERATION_ID_RESPONSE, mutationOutcome: 'malformed-response', expectedBackTarget: 'S03-R12' }),
  r13('mutation-extra-response-field', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { exportResponse: P5_EXPORT_EXTRA_FIELD_RESPONSE, mutationOutcome: 'malformed-response', expectedBackTarget: 'S03-R12' }),
  r13('mutation-missing-response-id', reportRange, P5_REPORTS_AUTHORIZED_RESPONSE, { exportResponse: P5_EXPORT_MISSING_ID_RESPONSE, mutationOutcome: 'malformed-response', expectedBackTarget: 'S03-R12' }),
] as const;

export const SECTION03_P5_FIXTURES: readonly Section03P5Fixture[] = deepFreeze(fixtures);
export const SECTION03_P5_FIXTURE_IDS = deepFreeze(SECTION03_P5_FIXTURES.map((item) => item.fixtureId));

export const P5_BROWSER_RESPONSES = deepFreeze({
  workplaceAuthorized: P5_REPORTS_AUTHORIZED_RESPONSE,
  workplaceUnauthorized: P5_REPORTS_UNAUTHORIZED_RESPONSE,
  workplaceUnrelatedAuthority: P5_REPORTS_UNRELATED_AUTHORITY_RESPONSE,
  exportSuccess: P5_EXPORT_SUCCESS_RESPONSE,
  exportFallbackId: P5_EXPORT_FALLBACK_ID_RESPONSE,
});
