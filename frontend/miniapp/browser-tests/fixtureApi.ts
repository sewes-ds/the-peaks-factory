import { ApiClient } from '../src/foundation/apiClient';
import {
  P1_DOWNTIMES_RESPONSE,
  P1_DOWNTIME_TYPES_RESPONSE,
  P1_MACHINES_RESPONSE,
  P1_MACHINE_CRITICAL,
  P1_MACHINE_IDLE,
  P1_MACHINE_OPERATIONAL,
  P1_MACHINE_PRODUCTION,
  P1_WORKPLACE_RESPONSE,
  SECTION03_P1_FIXTURES,
} from '../src/section03/fixtures/p1';
import {
  P2A1_EMPLOYEES_POPULATED_RESPONSE,
  P2A1_EMPLOYEE_ALL_BLOCKERS,
  SECTION03_P2A1_FIXTURES,
} from '../src/section03/fixtures/p2a1Employees';
import {
  SECTION03_P2A2A_FIXTURES,
} from '../src/section03/fixtures/p2a2aShiftClose';
import {
  P2A2B_CARD_ALL,
  P2A2B_CARD_NONE,
  SECTION03_P2A2B_FIXTURES,
} from '../src/section03/fixtures/p2a2bBlockers';
import {
  SECTION03_P2B1_EMPLOYEE_FIXTURE_ALIASES,
  SECTION03_P2B1_FIXTURES,
} from '../src/section03/fixtures/p2b1CompletedWorks';
import {
  SECTION03_P2B2_FIXTURES,
} from '../src/section03/fixtures/p2b2Salary';
import {
  SECTION03_P3A1_FIXTURES,
} from '../src/section03/fixtures/p3a1AdditionalWorkRequests';
import {
  P3A2_MIXED_RESPONSE,
  SECTION03_P3A2_FIXTURES,
} from '../src/section03/fixtures/p3a2AdditionalWorkLifecycle';
import {
  P3A3_EMPLOYEES_EMPTY_RESPONSE,
  P3A3_EMPLOYEES_RESPONSE,
  P3A3_WORK_TYPES_RESPONSE,
  SECTION03_P3A3_FIXTURES,
} from '../src/section03/fixtures/p3a3AssignAdditionalWork';
import {
  P3A4_WAITING_RESPONSE,
  SECTION03_P3A4_FIXTURES,
} from '../src/section03/fixtures/p3a4AdditionalWorkAccrual';
import {
  P4A1_EMPLOYEES_RESPONSE,
  SECTION03_P4A1_FIXTURES,
} from '../src/section03/fixtures/p4a1CorrectionsEntry';
import {
  P4A2_WORKPLACE_AUTHORIZED_RESPONSE,
  SECTION03_P4A2_FIXTURES,
} from '../src/section03/fixtures/p4a2FinancialCorrectionCreate';
import {
  P4A3_ADDITIONAL_CARD_RESPONSE,
  P4A3_EMPLOYEES_RESPONSE,
  P4A3_PRODUCTION_CARD_RESPONSE,
  P4A3_WORKPLACE_AUTHORIZED_RESPONSE,
  P4A3_WORKS_MIXED_RESPONSE,
  SECTION03_P4A3_FIXTURES,
} from '../src/section03/fixtures/p4a3FinancialCorrectionReversal';
import {
  P4A4_EMPLOYEE_OPERATIONS_RESPONSE,
  P4A4_EMPLOYEES_RESPONSE,
  P4A4_MACHINE_OPERATIONS_RESPONSE,
  P4A4_MACHINES_RESPONSE,
  P4A4_WORKPLACE_AUTHORIZED_RESPONSE,
  SECTION03_P4A4_FIXTURES,
} from '../src/section03/fixtures/p4a4ProductionCorrection';
import {
  P4A5_BROWSER_RESPONSES,
  P4A5_NOTIFICATIONS_ALL_RESPONSE,
  SECTION03_P4A5_FIXTURES,
} from '../src/section03/fixtures/p4a5Notifications';
import {
  P5_EXPORT_SUCCESS_RESPONSE,
  P5_REPORTS_AUTHORIZED_RESPONSE,
  SECTION03_P5_FIXTURES,
} from '../src/section03/fixtures/p5Reports';
import type {
  ManagerCompletedWorkCardResponse,
  ManagerProductionCompletedOperationsResponse,
  ManagerSalaryCorrectionContextResponse,
  ManagerWorkplaceState,
  ManagerOpenTasksResponse,
} from '../src/section03/contracts';

export const ALL_AVAILABLE_ACTIONS = Object.freeze([
  'OPEN_MACHINES', 'OPEN_EMPLOYEES', 'OPEN_DOWNTIMES', 'OPEN_ADDITIONAL_WORKS', 'OPEN_CORRECTIONS', 'OPEN_NOTIFICATIONS', 'OPEN_REPORTS',
  'OPEN_MACHINE_CARD', 'FINISH_DOWNTIME', 'START_CRITICAL_DOWNTIME', 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER',
  'FINISH_PRODUCTION', 'FINISH_BREAK', 'FINISH_ADDITIONAL_WORK', 'APPROVE_ADDITIONAL_WORK_REQUEST',
  'REJECT_ADDITIONAL_WORK_REQUEST', 'CANCEL_ADDITIONAL_WORK', 'ASSIGN_ADDITIONAL_WORK',
  'ACCRUE_ADDITIONAL_WORK_SALARY', 'MARK_WITHOUT_ACCRUAL',
]);

const machine = Object.freeze({
  machine_id: 'M-1', machine_name: 'Станок с очень длинным наименованием для проверки переноса текста на мобильном экране',
  ui_state: 'warning', ui_variant: 'yellow', active_production_operation_id: 'PO-1', active_employee_id: 'EMP-1',
  active_employee_full_name: 'Сотрудник с длинным отображаемым именем', active_sku_id: 'SKU-1', active_sku_code: 'SKU-001',
  active_sku_name: 'Деталь с длинным названием', active_break_id: null, active_break_name: null, active_downtime_id: 'D-1',
  downtime_type: 'operational', downtime_name: 'Операционный простой', downtime_start_comment: 'Подробный многострочный комментарий, который должен увеличить высоту карточки и не пересекаться с соседним элементом.',
  downtime_comment: 'Подробный многострочный комментарий, который должен увеличить высоту карточки и не пересекаться с соседним элементом.', downtime_finish_comment: null,
  downtime_started_at: '2026-07-31T10:00:00+05:00', downtime_duration: '1 ч 20 мин',
  has_active_critical_downtime: false, has_active_operational_downtime: true,
  active_operational_downtime_id: 'D-1', is_selectable_for_manager_critical_downtime: true,
  available_actions: ALL_AVAILABLE_ACTIONS,
});

function workplace() {
  const section = (title: string) => ({ title, ui_variant: 'light_blue', available_actions: ALL_AVAILABLE_ACTIONS });
  return {
    section: 'S03', screen: 'S03-N01', manager: { employee_id: 'EMP-1', full_name: 'Начальник производства' },
    sections: {
      machines: { ...section('Станки'), running_count: 3, downtime_count: 2, idle_count: 1, downtime_severity: 'operational' },
      employees: { ...section('Сотрудники'), open_shift_count: 5, production_count: 3, downtime_count: 1, additional_work_count: 1, break_count: 1, without_work_count: 0, production_downtime_severity: 'operational' },
      downtimes: { ...section('Простои'), critical_count: 1, operational_count: 2 },
      additional_works: { ...section('Доп. работы'), ui_variant: 'grey', requested_count: 1, approved_count: 1, active_count: 1, requires_accrual_count: 1 },
      corrections: section('Корректировки'), notifications: { ...section('Уведомления'), open_tasks_count: 2 },
      reports: { title: 'Отчёты', ui_variant: 'light_blue', available_actions: [], is_placeholder: true },
    },
    available_actions: ALL_AVAILABLE_ACTIONS,
  };
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function additionalWorkTypesResponseForRequest(requestUrl: URL, empty = false) {
  const employeeId = requestUrl.searchParams.get('employee_id') ?? P3A3_WORK_TYPES_RESPONSE.assignability_employee_id;
  const selectedTypeId = requestUrl.searchParams.get('additional_work_type_id');
  const baseItems = empty ? [] : [...P3A3_WORK_TYPES_RESPONSE.additional_work_types];
  const items = selectedTypeId === null || baseItems.some((item) => item.additional_work_type_id === selectedTypeId)
    ? baseItems
    : [{ ...baseItems[0]!, additional_work_type_id: selectedTypeId }];
  return Object.freeze({
    ...P3A3_WORK_TYPES_RESPONSE,
    assignability_employee_id: employeeId,
    assignability_additional_work_type_id: selectedTypeId,
    additional_work_types: Object.freeze(items),
    available_actions: Object.freeze(items.some((item) => item.can_assign)
      ? (['ASSIGN_ADDITIONAL_WORK', 'BACK'] as const)
      : (['BACK'] as const)),
  });
}

export type BrowserFixtureRequest = Readonly<{
  method: string;
  path: string;
  body: unknown;
}>;

function createFixtureClient(requests?: BrowserFixtureRequest[]): ApiClient {
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const requestUrl = new URL(String(request));
      const path = requestUrl.pathname;
      requests?.push(Object.freeze({
        method: init?.method ?? 'GET',
        path,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (init?.method === 'POST' && path.endsWith('/finish') && path.startsWith('/machine-downtimes/')) return response({ id: path.split('/')[2] });
      if (init?.method === 'POST' && path === '/exports/google-sheets') return response({ export_run_id: '42' });
      if (init?.method === 'POST') return response({ id: 'RESULT-1' });
      if (path === '/manager/workplace-state') return response(workplace());
      if (path === '/manager/machines') return response({ section: 'S03', screen: 'S03-M01', title: 'Станки', machines: [machine], available_actions: ALL_AVAILABLE_ACTIONS });
      if (/^\/manager\/machines\/[^/]+$/.test(path)) return response({ section: 'S03', screen: 'S03-M02', machine, available_actions: ALL_AVAILABLE_ACTIONS });
      if (path.includes('/completed-production-operations')) return response({
        ...P4A4_MACHINE_OPERATIONS_RESPONSE,
        machine: { machine_id: 'M-1', machine_name: P4A4_MACHINE_OPERATIONS_RESPONSE.machine.machine_name },
        operations: P4A4_MACHINE_OPERATIONS_RESPONSE.operations.map((item) => ({
          ...item, operation_id: 'OP-1', production_operation_id: 'PO-1', machine_id: 'M-1',
        })),
      });
      if (path === '/manager/downtimes') return response({ section: 'S03', screen: 'S03-D01', downtimes: [{ ...machine, downtime_id: 'D-1' }], available_actions: ALL_AVAILABLE_ACTIONS });
      if (path === '/manager/downtime-types/critical') return response({ section: 'S03', screen: 'S03-D10', downtime_types: [{ downtime_type_id: 'DT-1', downtime_type_name: 'Критический простой' }], available_actions: ALL_AVAILABLE_ACTIONS });
      if (path === '/manager/employees') return response(P2A1_EMPLOYEES_POPULATED_RESPONSE);
      if (/^\/manager\/employees\/[^/]+$/.test(path)) return response({ section: 'S03', screen: 'S03-E02', employee: P2A1_EMPLOYEE_ALL_BLOCKERS, available_actions: ['BACK'] });
      if (path.endsWith('/completed-works') && requestUrl.searchParams.get('type') === 'production') {
        return response({
          ...P4A4_EMPLOYEE_OPERATIONS_RESPONSE,
          employee: { employee_id: 'EMP-1', full_name: P4A4_EMPLOYEE_OPERATIONS_RESPONSE.employee.full_name },
          works: P4A4_EMPLOYEE_OPERATIONS_RESPONSE.works.map((item) => ({
            ...item, operation_id: 'OP-1', production_operation_id: 'PO-1', employee_id: 'EMP-1',
          })),
        });
      }
      if (path.endsWith('/completed-works')) return response(SECTION03_P2B1_FIXTURES.find((fixture) => fixture.fixtureId === 'S03-E21:mixed-production-additional')!.apiResponse);
      const completedWorkCardMatch = path.match(
        /^\/manager\/employees\/([^/]+)\/completed-works\/([^/]+)\/([^/]+)$/,
      );
      if (completedWorkCardMatch !== null) {
        const value = SECTION03_P2B1_FIXTURES.find(
          (fixture) => fixture.fixtureId === 'S03-E22:production-all-actions',
        )!.apiResponse as Readonly<{
          employee: Readonly<Record<string, unknown>>;
          work: Readonly<Record<string, unknown>>;
        }>;
        return response({
          ...value,
          employee: { ...value.employee, employee_id: completedWorkCardMatch[1] },
          work: {
            ...value.work,
            employee_id: completedWorkCardMatch[1],
            work_type: completedWorkCardMatch[2],
            operation_id: completedWorkCardMatch[3],
          },
        });
      }
      if (path.endsWith('/salary/history')) {
        const value = SECTION03_P2B2_FIXTURES.find((fixture) => fixture.fixtureId === 'S03-SAL02:mixed-months')!.apiResponse;
        return response({ ...value, employee_id: 'EMP-1', employee: { ...value.employee, employee_id: 'EMP-1' } });
      }
      if (path.endsWith('/salary')) {
        const value = SECTION03_P2B2_FIXTURES.find((fixture) => fixture.fixtureId === 'S03-SAL01:summary-with-breakdown')!.apiResponse;
        return response({ ...value, employee_id: 'EMP-1', employee: { ...value.employee, employee_id: 'EMP-1' } });
      }
      if (path === '/manager/additional-works') {
        const representative = SECTION03_P3A1_FIXTURES[0].apiResponse;
        return response({
          ...representative,
          groups: {
            ...representative.groups,
            waiting_accrual: P3A4_WAITING_RESPONSE.groups.waiting_accrual,
          },
        });
      }
      if (path === '/manager/additional-work-types/available') {
        return response(additionalWorkTypesResponseForRequest(requestUrl));
      }
      if (path === '/manager/salary-correction-context') return response(P4A1_EMPLOYEES_RESPONSE);
      if (path === '/manager/notifications/open-tasks') return response(P4A5_NOTIFICATIONS_ALL_RESPONSE);
      return response({ error: path }, 404);
    },
  });
}

export function createBrowserFixtureApiClient(): ApiClient {
  return createFixtureClient();
}

export function createBrowserFixtureApiHarness(): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
}> {
  const requests: BrowserFixtureRequest[] = [];
  return Object.freeze({ apiClient: createFixtureClient(requests), requests });
}

const P1_MACHINES_BY_ID = Object.freeze({
  'M-OP': P1_MACHINE_OPERATIONAL,
  'M-CRIT': P1_MACHINE_CRITICAL,
  'M-PROD': P1_MACHINE_PRODUCTION,
  'M-IDLE': P1_MACHINE_IDLE,
} as const);

export function createBrowserP1FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
}> {
  const requests: BrowserFixtureRequest[] = [];
  let operationalDowntimeFinished = false;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const requestUrl = new URL(String(request));
      const path = requestUrl.pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        if (path.endsWith('/finish')) {
          if (path === '/machine-downtimes/D-OP/finish') operationalDowntimeFinished = true;
          return response({ id: path.split('/')[2] });
        }
        if (path === '/machine-downtimes/start') return response({ id: 'D-STARTED' });
      }
      if (path === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (path === '/manager/machines') return response(P1_MACHINES_RESPONSE);
      if (path === '/manager/downtimes') return response(P1_DOWNTIMES_RESPONSE);
      if (path === '/manager/downtime-types/critical') return response(P1_DOWNTIME_TYPES_RESPONSE);
      const machineMatch = path.match(/^\/manager\/machines\/([^/]+)$/);
      if (machineMatch !== null) {
        const machineId = machineMatch[1] as keyof typeof P1_MACHINES_BY_ID;
        const selected = machineId === 'M-OP' && operationalDowntimeFinished
          ? Object.freeze({
              ...P1_MACHINE_OPERATIONAL,
              ui_state: 'running', ui_variant: 'green', active_downtime_id: null, downtime_type: null,
              downtime_name: null, downtime_started_at: null, downtime_duration: null,
              has_active_operational_downtime: false, active_operational_downtime_id: null,
              available_actions: Object.freeze(['OPEN_MACHINE_CARD', 'START_CRITICAL_DOWNTIME']),
            })
          : P1_MACHINES_BY_ID[machineId];
        if (selected !== undefined) {
          return response({ section: 'S03', screen: 'S03-M02', machine: selected, available_actions: ['BACK'] });
        }
      }
      return response({ error: path }, 404);
    },
  });
  return Object.freeze({ apiClient, requests });
}

export function createBrowserP1VariantApiClient(fixtureId: string): ApiClient {
  const fixture = SECTION03_P1_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P1 fixture ${fixtureId}.`);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const path = new URL(String(request)).pathname;
      const value = fixture.apiResponses[path];
      if (value !== undefined) return response(value);
      if (init?.method === 'POST') return response({ id: 'LOCAL-RESULT' });
      return response({ error: path, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP2A1VariantApiClient(fixtureId: string): ApiClient {
  const fixture = SECTION03_P2A1_FIXTURES.find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (fixture === undefined) throw new Error(`Unknown P2A1 fixture ${fixtureId}.`);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const path = new URL(String(request)).pathname;
      const value = fixture.apiResponses[path];
      return value === undefined
        ? response({ error: path, fixture_id: fixtureId }, 404)
        : response(value);
    },
  });
}

export function createBrowserP2A1FixtureApiHarness(
  initialFixtureId: string,
): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  resolveBlockers: () => void;
  setFixture: (fixtureId: string) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let fixtureId = initialFixtureId;
  let blockersResolved = false;
  const selectedFixture = () => {
    const fixture = SECTION03_P2A1_FIXTURES.find(
      (candidate) => candidate.fixtureId === fixtureId,
    );
    if (fixture === undefined || fixture.nodeId !== 'S03-E02') {
      throw new Error(`P2A1 DOM fixture must be an E02 card: ${fixtureId}.`);
    }
    return fixture;
  };
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const path = new URL(String(request)).pathname;
      requests.push(Object.freeze({
        method: init?.method ?? 'GET',
        path,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (path === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      const fixture = selectedFixture();
      const selectedCard = Object.values(fixture.apiResponses)[0] as Readonly<{
        employee: Readonly<Record<string, unknown>>;
      }>;
      const card: Readonly<{
        employee: Readonly<Record<string, unknown>>;
      }> = blockersResolved
        ? Object.freeze({
            ...selectedCard,
            employee: Object.freeze({
              ...selectedCard.employee,
              blockers: Object.freeze({
                production: null,
                break: null,
                additional_work: null,
              }),
            }),
          })
        : selectedCard;
      const employeeId = String(card.employee.employee_id);
      if (path === '/manager/employees') {
        return response({
          section: 'S03',
          screen: 'S03-E01',
          title: 'Сотрудники',
          employees: [{
            ...card.employee,
            available_actions: ['OPEN_EMPLOYEE_CARD'],
          }],
          available_actions: ['BACK'],
        });
      }
      const employeeMatch = path.match(/^\/manager\/employees\/([^/]+)$/);
      if (employeeMatch !== null) {
        return employeeMatch[1] === employeeId
          ? response(card)
          : response({ error: path, fixture_id: fixtureId }, 404);
      }
      const salaryMatch = path.match(/^\/manager\/employees\/([^/]+)\/salary$/);
      if (salaryMatch !== null && salaryMatch[1] === employeeId) {
        return response({
          section: 'S03',
          screen: 'S03-SAL01',
          employee_id: employeeId,
          employee: { employee_id: employeeId, full_name: card.employee.full_name },
          totals: { today_uzs: 125000, week_uzs: 125000, month_uzs: 125000 },
        });
      }
      const completedWorksMatch = path.match(
        /^\/manager\/employees\/([^/]+)\/completed-works$/,
      );
      if (completedWorksMatch !== null && completedWorksMatch[1] === employeeId) {
        return response({
          section: 'S03',
          screen: 'S03-E21',
          employee: { employee_id: employeeId, full_name: card.employee.full_name },
          works: [],
          available_actions: ['BACK'],
        });
      }
      return response({ error: path, fixture_id: fixtureId }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    resolveBlockers: () => {
      blockersResolved = true;
    },
    setFixture: (nextFixtureId: string) => {
      fixtureId = nextFixtureId;
      blockersResolved = false;
      selectedFixture();
    },
  });
}

export function createBrowserP2A2aVariantApiClient(fixtureId: string): ApiClient {
  const fixture = SECTION03_P2A2A_FIXTURES.find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (fixture === undefined) throw new Error(`Unknown P2A2a fixture ${fixtureId}.`);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const path = new URL(String(request)).pathname;
      if (init?.method === 'POST') return response({ id: 'SHIFT-CLOSED' });
      const value = fixture.apiResponses[path];
      return value === undefined
        ? response({ error: path, fixture_id: fixtureId }, 404)
        : response(value);
    },
  });
}

export function createBrowserP2A2aFixtureApiHarness(
  failClose: boolean,
  delayMilliseconds = 180,
): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setAuthorized: (authorized: boolean) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  const source = SECTION03_P2A2A_FIXTURES.find(
    (fixture) => fixture.fixtureId === 'S03-E11:valid-authorized',
  );
  if (source === undefined) throw new Error('Missing P2A2a authorized fixture.');
  const sourceEmployee = (source.employeeCardResponse as Readonly<{
    employee: Readonly<Record<string, unknown>>;
  }>).employee;
  let authorized = true;
  const employee = () => Object.freeze({
    ...sourceEmployee,
    available_actions: Object.freeze(authorized
      ? ['FINISH_EMPLOYEE_SHIFT_BY_MANAGER']
      : []),
  });
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const path = new URL(String(request)).pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        return failClose
          ? response({ error: 'Не удалось завершить смену' }, 503)
          : response({ id: 'SHIFT-CLOSED' });
      }
      if (path === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (path === '/manager/employees') {
        return response({
          section: 'S03', screen: 'S03-E01', title: 'Сотрудники',
          employees: [{ ...employee(), available_actions: ['OPEN_EMPLOYEE_CARD'] }],
          available_actions: ['BACK'],
        });
      }
      if (/^\/manager\/employees\/[^/]+$/.test(path)) {
        return response({
          section: 'S03', screen: 'S03-E02', employee: employee(),
          available_actions: ['BACK'],
        });
      }
      return response({ error: path }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setAuthorized: (value: boolean) => { authorized = value; },
  });
}

export function createBrowserP2A2bVariantApiClient(fixtureId: string): ApiClient {
  const fixture = SECTION03_P2A2B_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P2A2b fixture ${fixtureId}.`);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const path = new URL(String(request)).pathname;
      if (init?.method === 'POST') return response({ id: 'BLOCKER-FINISHED' });
      if (/^\/manager\/employees\/[^/]+$/.test(path)) return response(fixture.initialResponse);
      return response({ error: path, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP2A2bFixtureApiHarness(
  scenario: 'production-blocker-remains' | 'production-last-blocker' | 'break-blocker-outcomes' | 'additional-work-blocker-outcomes',
  delayMilliseconds = 180,
): Readonly<{ apiClient: ApiClient; requests: BrowserFixtureRequest[] }> {
  const requests: BrowserFixtureRequest[] = [];
  let mutated = false;
  const source = (P2A2B_CARD_ALL as Readonly<{ employee: Readonly<Record<string, unknown>> }>).employee;
  const initialBlockers = scenario === 'production-last-blocker'
    ? { production: source.blockers && (source.blockers as Readonly<Record<string, unknown>>).production, break: null, additional_work: null }
    : scenario === 'break-blocker-outcomes'
      ? { production: null, break: source.blockers && (source.blockers as Readonly<Record<string, unknown>>).break, additional_work: null }
      : scenario === 'additional-work-blocker-outcomes'
        ? { production: null, break: null, additional_work: source.blockers && (source.blockers as Readonly<Record<string, unknown>>).additional_work }
        : (source.blockers as Readonly<Record<string, unknown>>);
  const initialCard = Object.freeze({
    ...P2A2B_CARD_ALL,
    employee: Object.freeze({
      ...source,
      blockers: Object.freeze(initialBlockers),
      available_actions: Object.freeze([
        'VIEW_SALARY', 'VIEW_COMPLETED_WORKS', 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER',
      ]),
    }),
  });
  const remainingCard = scenario === 'production-blocker-remains'
    ? Object.freeze({
        ...initialCard,
        employee: Object.freeze({
          ...initialCard.employee,
          blockers: Object.freeze({
            production: null,
            break: (source.blockers as Readonly<Record<string, unknown>>).break,
            additional_work: null,
          }),
        }),
      })
    : P2A2B_CARD_NONE;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const path = new URL(String(request)).pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method, path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        mutated = true;
        return response({ id: 'BLOCKER-FINISHED' });
      }
      if (path === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (path === '/manager/employees') return response({
        section: 'S03', screen: 'S03-E01', title: 'Сотрудники',
        employees: [{ ...initialCard.employee, available_actions: ['OPEN_EMPLOYEE_CARD'] }],
        available_actions: ['BACK'],
      });
      if (/^\/manager\/employees\/[^/]+$/.test(path)) return response(mutated ? remainingCard : initialCard);
      return response({ error: path }, 404);
    },
  });
  return Object.freeze({ apiClient, requests });
}

function p2b1Fixture(fixtureId: string) {
  const fixture = SECTION03_P2B1_FIXTURES.find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (fixture === undefined) throw new Error(`Unknown P2B1 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP2B1VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p2b1Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const url = new URL(String(request));
      if (fixture.apiResponse !== null) return response(fixture.apiResponse);
      return response({ error: `${url.pathname}${url.search}`, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP2B1FixtureApiHarness(): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setListFixture: (fixtureId: string) => void;
  setCardFixture: (fixtureId: string) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let listFixtureId = 'S03-E21:mixed-production-additional';
  let cardFixtureId = 'S03-E22:production-all-actions';
  const currentWorker = SECTION03_P2B1_EMPLOYEE_FIXTURE_ALIASES['EMP-CW'];
  const employeeCard = Object.freeze({
    ...P2A1_EMPLOYEE_ALL_BLOCKERS,
    ...currentWorker,
    blockers: Object.freeze({ production: null, break: null, additional_work: null }),
    available_actions: Object.freeze(['VIEW_COMPLETED_WORKS']),
  });
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: `${path}${url.search}`,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method !== 'GET') return response({ error: 'P2B1 is read-only' }, 405);
      if (path === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (path === '/manager/employees') return response({
        section: 'S03', screen: 'S03-E01', title: 'Сотрудники',
        employees: [{ ...employeeCard, available_actions: ['OPEN_EMPLOYEE_CARD'] }],
        available_actions: ['BACK'],
      });
      if (path === `/manager/employees/${currentWorker.employee_id}`) return response({
        section: 'S03', screen: 'S03-E02', employee: employeeCard,
        available_actions: ['BACK'],
      });
      if (path.startsWith(
        `/manager/employees/${currentWorker.employee_id}/completed-works/`,
      )) {
        return response(p2b1Fixture(cardFixtureId).apiResponse);
      }
      if (path === `/manager/employees/${currentWorker.employee_id}/completed-works`) {
        const listResponse = p2b1Fixture(listFixtureId).apiResponse;
        return url.searchParams.get('type') === 'production' &&
          listResponse !== null && 'works' in listResponse
          ? response({
              ...listResponse,
              screen: 'S03-CP12',
              works: listResponse.works.filter((item) => item.work_type === 'production'),
            })
          : response(listResponse);
      }
      return response({ error: `${path}${url.search}` }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setListFixture: (fixtureId: string) => {
      const fixture = p2b1Fixture(fixtureId);
      if (fixture.nodeId !== 'S03-E21' || fixture.expectProjectionFailure) {
        throw new Error(`P2B1 list fixture must be valid E21: ${fixtureId}.`);
      }
      listFixtureId = fixtureId;
    },
    setCardFixture: (fixtureId: string) => {
      const fixture = p2b1Fixture(fixtureId);
      if (fixture.nodeId !== 'S03-E22' || fixture.expectProjectionFailure) {
        throw new Error(`P2B1 card fixture must be valid E22: ${fixtureId}.`);
      }
      cardFixtureId = fixtureId;
    },
  });
}

function p2b2Fixture(fixtureId: string) {
  const fixture = SECTION03_P2B2_FIXTURES.find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (fixture === undefined) throw new Error(`Unknown P2B2 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP2B2VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p2b2Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async () => response(fixture.apiResponse),
  });
}

export function createBrowserP2B2FixtureApiHarness(): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setSummaryFixture: (fixtureId: string) => void;
  setHistoryFixture: (fixtureId: string) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let summaryFixtureId = 'S03-SAL01:summary-with-breakdown';
  let historyFixtureId = 'S03-SAL02:mixed-months';
  const employeeCard = Object.freeze({
    ...P2A1_EMPLOYEE_ALL_BLOCKERS,
    employee_id: 'EMP-SALARY',
    full_name: 'Мария Орлова',
    blockers: Object.freeze({ production: null, break: null, additional_work: null }),
    available_actions: Object.freeze(['VIEW_SALARY']),
  });
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: `${path}${url.search}`,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method !== 'GET') return response({ error: 'P2B2 is read-only' }, 405);
      if (path === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (path === '/manager/employees') return response({
        section: 'S03', screen: 'S03-E01', title: 'Сотрудники',
        employees: [{ ...employeeCard, available_actions: ['OPEN_EMPLOYEE_CARD'] }],
        available_actions: ['BACK'],
      });
      if (path === '/manager/employees/EMP-SALARY') return response({
        section: 'S03', screen: 'S03-E02', employee: employeeCard,
        available_actions: ['BACK'],
      });
      if (path === '/manager/employees/EMP-SALARY/salary/history') {
        return response(p2b2Fixture(historyFixtureId).apiResponse);
      }
      if (path === '/manager/employees/EMP-SALARY/salary') {
        return response(p2b2Fixture(summaryFixtureId).apiResponse);
      }
      return response({ error: `${path}${url.search}` }, 404);
    },
  });
  const assign = (fixtureId: string, nodeId: 'S03-SAL01' | 'S03-SAL02') => {
    const fixture = p2b2Fixture(fixtureId);
    if (fixture.nodeId !== nodeId || fixture.expectProjectionFailure) {
      throw new Error(`P2B2 fixture must be valid ${nodeId}: ${fixtureId}.`);
    }
    return fixtureId;
  };
  return Object.freeze({
    apiClient,
    requests,
    setSummaryFixture: (fixtureId: string) => { summaryFixtureId = assign(fixtureId, 'S03-SAL01'); },
    setHistoryFixture: (fixtureId: string) => { historyFixtureId = assign(fixtureId, 'S03-SAL02'); },
  });
}

function p3a1Fixture(fixtureId: string) {
  const fixture = SECTION03_P3A1_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P3A1 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP3A1VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p3a1Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async () => response(fixture.apiResponse),
  });
}

export function createBrowserP3A1FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setFailure: (value: boolean) => void;
  resetList: () => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let failure = false;
  let listFixtureId = 'S03-AW01:mixed-groups';
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method, path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        if (failure) return response({ error: 'fixture-local failure' }, 503);
        listFixtureId = 'S03-AW01:empty';
        return response({ id: 'P3A1-RESULT' });
      }
      if (url.pathname === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (url.pathname === '/manager/additional-works') return response(p3a1Fixture(listFixtureId).apiResponse);
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setFailure: (value: boolean) => { failure = value; },
    resetList: () => { listFixtureId = 'S03-AW01:mixed-groups'; },
  });
}

function p3a2Fixture(fixtureId: string) {
  const fixture = SECTION03_P3A2_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P3A2 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP3A2VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p3a2Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async () => response(fixture.apiResponse),
  });
}

export function createBrowserP3A2FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setFailure: (value: boolean) => void;
  resetList: () => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let failure = false;
  let listResponse = P3A2_MIXED_RESPONSE;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        if (failure) return response({ error: 'fixture-local failure' }, 503);
        listResponse = SECTION03_P3A1_FIXTURES.find((fixture) => fixture.fixtureId === 'S03-AW01:empty')!.apiResponse;
        return response({ id: 'P3A2-RESULT' });
      }
      if (url.pathname === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (url.pathname === '/manager/additional-works') return response(listResponse);
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setFailure: (value: boolean) => { failure = value; },
    resetList: () => { listResponse = P3A2_MIXED_RESPONSE; },
  });
}

function p3a3Fixture(fixtureId: string) {
  const fixture = SECTION03_P3A3_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P3A3 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP3A3VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p3a3Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async () => response(fixture.apiResponse),
  });
}

export function createBrowserP3A3FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setFailure: (value: boolean) => void;
  setEmployeesEmpty: (value: boolean) => void;
  setWorkTypesEmpty: (value: boolean) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let failure = false;
  let employeesEmpty = false;
  let workTypesEmpty = false;
  let listResponse = P3A2_MIXED_RESPONSE;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      url.searchParams.delete('_');
      const query = url.searchParams.toString();
      requests.push(Object.freeze({
        method,
        path: `${url.pathname}${query === '' ? '' : `?${query}`}`,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        if (failure) return response({
          error: {
            code: 'additional_work_assignment_already_exists',
            message: 'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.',
          },
        }, 409);
        listResponse = SECTION03_P3A1_FIXTURES.find((fixture) => fixture.fixtureId === 'S03-AW01:empty')!.apiResponse;
        return response({ id: 'P3A3-RESULT' });
      }
      if (url.pathname === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (url.pathname === '/manager/additional-works') return response(listResponse);
      if (url.pathname === '/manager/employees') {
        return response(employeesEmpty ? P3A3_EMPLOYEES_EMPTY_RESPONSE : P3A3_EMPLOYEES_RESPONSE);
      }
      if (url.pathname === '/manager/additional-work-types/available') {
        return response(additionalWorkTypesResponseForRequest(url, workTypesEmpty));
      }
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setFailure: (value: boolean) => { failure = value; },
    setEmployeesEmpty: (value: boolean) => { employeesEmpty = value; },
    setWorkTypesEmpty: (value: boolean) => { workTypesEmpty = value; },
  });
}

function p3a4Fixture(fixtureId: string) {
  const fixture = SECTION03_P3A4_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P3A4 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP3A4VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p3a4Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async () => response(fixture.apiResponse),
  });
}

export function createBrowserP3A4FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setFailure: (value: boolean) => void;
  resetList: () => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let failure = false;
  let listResponse = P3A4_WAITING_RESPONSE;
  const emptyResponse = SECTION03_P3A1_FIXTURES.find((fixture) => fixture.fixtureId === 'S03-AW01:empty')!.apiResponse;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        if (failure) return response({ error: 'fixture-local failure' }, 503);
        listResponse = emptyResponse;
        return response({ id: 'P3A4-RESULT' });
      }
      if (url.pathname === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (url.pathname === '/manager/additional-works') return response(listResponse);
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setFailure: (value: boolean) => { failure = value; },
    resetList: () => { listResponse = P3A4_WAITING_RESPONSE; },
  });
}

function p4a1Fixture(fixtureId: string) {
  const fixture = SECTION03_P4A1_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P4A1 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP4A1VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p4a1Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const path = new URL(String(request)).pathname;
      if (path === '/manager/salary-correction-context' && fixture.apiResponse !== null) {
        return response(fixture.apiResponse);
      }
      return response({ error: path }, 404);
    },
  });
}

export function createBrowserP4A1FixtureApiHarness(): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setCorrectionContext: (value: ManagerSalaryCorrectionContextResponse) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let correctionContext = P4A1_EMPLOYEES_RESPONSE;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'GET' && url.pathname === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (method === 'GET' && url.pathname === '/manager/salary-correction-context') return response(correctionContext);
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setCorrectionContext: (value: ManagerSalaryCorrectionContextResponse) => { correctionContext = value; },
  });
}

function p4a2Fixture(fixtureId: string) {
  const fixture = SECTION03_P4A2_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P4A2 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP4A2VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p4a2Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const path = new URL(String(request)).pathname;
      if (path === '/manager/salary-correction-context') return response(fixture.correctionResponse);
      if (path === '/manager/workplace-state') return response(fixture.workplaceResponse);
      return response({ error: path, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP4A2FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setFailure: (value: 'none' | 'apply') => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let failure: 'none' | 'apply' = 'none';
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        if (url.pathname === '/salary-corrections/apply') {
          return failure === 'apply'
            ? response({ error: 'fixture-local atomic apply failure' }, 503)
            : response({ id: 'RESULT-1' });
        }
      }
      if (url.pathname === '/manager/workplace-state') return response(P4A2_WORKPLACE_AUTHORIZED_RESPONSE);
      if (url.pathname === '/manager/salary-correction-context') return response(P4A1_EMPLOYEES_RESPONSE);
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setFailure: (value: 'none' | 'apply') => { failure = value; },
  });
}

function p4a3Fixture(fixtureId: string) {
  const fixture = SECTION03_P4A3_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P4A3 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP4A3VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p4a3Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const url = new URL(String(request));
      if (url.pathname === '/manager/employees') return response(fixture.primaryResponse);
      if (url.pathname === '/manager/workplace-state') return response(fixture.workplaceResponse);
      if (url.pathname.includes('/completed-works')) return response(fixture.primaryResponse);
      return response({ error: url.pathname, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP4A3FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setCardResponse: (value: ManagerCompletedWorkCardResponse | null) => void;
  setWorkplaceResponse: (value: ManagerWorkplaceState) => void;
  setFailure: (value: boolean) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let cardOverride: ManagerCompletedWorkCardResponse | null = null;
  let workplaceResponse = P4A3_WORKPLACE_AUTHORIZED_RESPONSE;
  let failure = false;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST' && url.pathname.startsWith('/salary-entries/')) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        return failure
          ? response({ error: 'fixture-local reversal failure' }, 503)
          : response({ status: 'reversed' });
      }
      if (method === 'GET' && url.pathname === '/manager/workplace-state') return response(workplaceResponse);
      if (method === 'GET' && url.pathname === '/manager/employees') return response(P4A3_EMPLOYEES_RESPONSE);
      if (method === 'GET' && url.pathname.endsWith('/completed-works')) return response(P4A3_WORKS_MIXED_RESPONSE);
      if (method === 'GET' && url.pathname.includes('/completed-works/')) {
        if (cardOverride !== null) return response(cardOverride);
        return response(url.pathname.includes('/additional_work/')
          ? P4A3_ADDITIONAL_CARD_RESPONSE
          : P4A3_PRODUCTION_CARD_RESPONSE);
      }
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setCardResponse: (value: ManagerCompletedWorkCardResponse | null) => { cardOverride = value; },
    setWorkplaceResponse: (value: ManagerWorkplaceState) => { workplaceResponse = value; },
    setFailure: (value: boolean) => { failure = value; },
  });
}

function p4a4Fixture(fixtureId: string) {
  const fixture = SECTION03_P4A4_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P4A4 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP4A4VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p4a4Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const url = new URL(String(request));
      if (url.pathname === '/manager/workplace-state') return response(fixture.workplaceResponse);
      if (url.pathname === '/manager/employees' || url.pathname === '/manager/machines' ||
        url.pathname.endsWith('/completed-works') || url.pathname.endsWith('/completed-production-operations')) {
        return response(fixture.primaryResponse);
      }
      return response({ error: url.pathname, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP4A4FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setOperationResponse: (value: ManagerProductionCompletedOperationsResponse) => void;
  setWorkplaceResponse: (value: ManagerWorkplaceState) => void;
  setFailure: (value: boolean) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let operationResponse: ManagerProductionCompletedOperationsResponse = P4A4_EMPLOYEE_OPERATIONS_RESPONSE;
  let workplaceResponse = P4A4_WORKPLACE_AUTHORIZED_RESPONSE;
  let failure = false;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'POST' && url.pathname === '/production-operation-corrections/apply') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        return failure
          ? response({ error: 'fixture-local production correction failure' }, 503)
          : response({ id: 'CORRECTION-1' });
      }
      if (method === 'GET' && url.pathname === '/manager/workplace-state') return response(workplaceResponse);
      if (method === 'GET' && url.pathname === '/manager/employees') return response(P4A4_EMPLOYEES_RESPONSE);
      if (method === 'GET' && url.pathname === '/manager/machines') return response(P4A4_MACHINES_RESPONSE);
      if (method === 'GET' && (url.pathname.endsWith('/completed-works') || url.pathname.endsWith('/completed-production-operations'))) {
        return response(operationResponse);
      }
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setOperationResponse: (value: ManagerProductionCompletedOperationsResponse) => { operationResponse = value; },
    setWorkplaceResponse: (value: ManagerWorkplaceState) => { workplaceResponse = value; },
    setFailure: (value: boolean) => { failure = value; },
  });
}

function p4a5Fixture(fixtureId: string) {
  const fixture = SECTION03_P4A5_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P4A5 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP4A5VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p4a5Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const url = new URL(String(request));
      return url.pathname === '/manager/notifications/open-tasks'
        ? response(fixture.apiResponse)
        : response({ error: url.pathname, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP4A5FixtureApiHarness(): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setNotificationsResponse: (value: ManagerOpenTasksResponse | unknown) => void;
  setNotificationsFailure: (value: boolean) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let notificationsResponse: unknown = P4A5_BROWSER_RESPONSES.all;
  let notificationsFailure = false;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method !== 'GET') return response({ error: 'P4A5 is read-only' }, 405);
      if (url.pathname === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
      if (url.pathname === '/manager/notifications/open-tasks') {
        return notificationsFailure
          ? response({ error: 'fixture-local notifications failure' }, 503)
          : response(notificationsResponse);
      }
      if (url.pathname === '/manager/additional-works') {
        const mixed = SECTION03_P3A1_FIXTURES.find((item) => item.fixtureId === 'S03-AW01:mixed-groups')!.apiResponse;
        return response({
          ...mixed,
          groups: { ...mixed.groups, waiting_accrual: P3A4_WAITING_RESPONSE.groups.waiting_accrual },
        });
      }
      const machineMatch = url.pathname.match(/^\/manager\/machines\/([^/]+)$/);
      if (machineMatch !== null) {
        const selected = P1_MACHINES_BY_ID[machineMatch[1] as keyof typeof P1_MACHINES_BY_ID];
        if (selected !== undefined) {
          return response({ section: 'S03', screen: 'S03-M02', machine: selected, available_actions: ['BACK'] });
        }
      }
      if (url.pathname === '/manager/machines') return response(P1_MACHINES_RESPONSE);
      if (url.pathname === '/manager/downtimes') return response(P1_DOWNTIMES_RESPONSE);
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setNotificationsResponse: (value: unknown) => { notificationsResponse = value; },
    setNotificationsFailure: (value: boolean) => { notificationsFailure = value; },
  });
}

function p5Fixture(fixtureId: string) {
  const fixture = SECTION03_P5_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`Unknown P5 fixture ${fixtureId}.`);
  return fixture;
}

export function createBrowserP5VariantApiClient(fixtureId: string): ApiClient {
  const fixture = p5Fixture(fixtureId);
  return new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request) => {
      const path = new URL(String(request)).pathname;
      if (path === '/manager/workplace-state' && fixture.workplaceResponse !== null) {
        return response(fixture.workplaceResponse);
      }
      return response({ error: path, fixture_id: fixtureId }, 404);
    },
  });
}

export function createBrowserP5FixtureApiHarness(delayMilliseconds = 180): Readonly<{
  apiClient: ApiClient;
  requests: BrowserFixtureRequest[];
  setWorkplaceResponse: (value: ManagerWorkplaceState) => void;
  setExportResponse: (value: unknown) => void;
  setExportFailure: (value: boolean) => void;
}> {
  const requests: BrowserFixtureRequest[] = [];
  let workplaceResponse = P5_REPORTS_AUTHORIZED_RESPONSE;
  let exportResponse: unknown = P5_EXPORT_SUCCESS_RESPONSE;
  let exportFailure = false;
  const apiClient = new ApiClient({
    baseUrl: 'http://fixture.local',
    fetchImpl: async (request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      }));
      if (method === 'GET' && url.pathname === '/manager/workplace-state') return response(workplaceResponse);
      if (method === 'GET' && url.pathname === '/manager/notifications/open-tasks') return response(P4A5_NOTIFICATIONS_ALL_RESPONSE);
      if (method === 'POST' && url.pathname === '/exports/google-sheets') {
        await new Promise((resolve) => window.setTimeout(resolve, delayMilliseconds));
        return exportFailure
          ? response({ error: 'fixture-local export failure' }, 503)
          : response(exportResponse);
      }
      return response({ error: url.pathname }, 404);
    },
  });
  return Object.freeze({
    apiClient,
    requests,
    setWorkplaceResponse: (value: ManagerWorkplaceState) => { workplaceResponse = value; },
    setExportResponse: (value: unknown) => { exportResponse = value; },
    setExportFailure: (value: boolean) => { exportFailure = value; },
  });
}
