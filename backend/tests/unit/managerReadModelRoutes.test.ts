import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ActorContext } from '../../src/auth/actorContext.js';
import { ApiError } from '../../src/db/errors.js';
import type { DbPool } from '../../src/db/pool.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import { managerReadModelRoutes } from '../../src/routes/managerReadModels.js';

const managerActor: ActorContext = {
  employeeId: 2n,
  telegramUserId: 2000n
};

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function managerRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    manager_employee_id: '2',
    manager_full_name: 'Production Manager',
    machine_running_count: '0',
    machine_downtime_count: '0',
    machine_idle_count: '0',
    machine_critical_downtime_count: '0',
    machine_operational_downtime_count: '0',
    employee_open_shift_count: '0',
    employee_production_active_clear_count: '0',
    employee_production_break_count: '0',
    employee_production_downtime_count: '0',
    employee_production_critical_downtime_count: '0',
    employee_production_operational_downtime_count: '0',
    employee_additional_work_active_clear_count: '0',
    employee_additional_work_break_count: '0',
    employee_open_shift_without_work_count: '0',
    downtime_critical_count: '0',
    downtime_operational_count: '0',
    additional_work_requested_count: '0',
    additional_work_approved_count: '0',
    additional_work_active_count: '0',
    open_tasks_count: '0',
    ...overrides
  };
}

function managerIdentityRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    manager_employee_id: '2',
    manager_full_name: 'Production Manager',
    ...overrides
  };
}

function machineRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    machine_id: '10',
    machine_name: '180 автомат',
    active_production_operation_id: null,
    active_employee_id: null,
    active_employee_full_name: null,
    active_sku_id: null,
    active_sku_code: null,
    active_sku_name: null,
    active_break_id: null,
    active_break_name: null,
    active_downtime_id: null,
    downtime_type: null,
    downtime_name: null,
    downtime_comment: null,
    downtime_started_at: null,
    ...overrides
  };
}

function employeeRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    employee_id: '20',
    full_name: 'Operator',
    open_shift_id: null,
    active_production_operation_id: null,
    active_machine_id: null,
    active_machine_name: null,
    active_sku_id: null,
    active_sku_code: null,
    active_sku_name: null,
    active_break_id: null,
    active_break_name: null,
    active_downtime_id: null,
    downtime_type: null,
    downtime_name: null,
    downtime_comment: null,
    active_additional_work_id: null,
    active_additional_work_name: null,
    ...overrides
  };
}

function additionalWorkRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    additional_work_id: '700',
    additional_work_type_id: '10',
    additional_work_name: 'Упаковка',
    employee_id: '20',
    employee_full_name: 'Operator',
    requested_at: '2026-07-01 08:00:00+03',
    created_at: '2026-07-01 08:00:00+03',
    started_at: null,
    finished_at: null,
    status: 'requested',
    ...overrides
  };
}

function openTaskRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    notification_id: '900',
    created_at: '2026-07-01 08:00:00+03',
    source_table: 'additional_works',
    source_id: '700',
    task_type: 'additional_work_request',
    title: 'Запрошена доп. работа',
    description: 'Нужно согласовать',
    ...overrides
  };
}

async function buildRouteApp(options: {
  rows: readonly Record<string, unknown>[];
  queryResults?: Array<readonly Record<string, unknown>[]>;
  authenticated?: boolean;
  onQuery?: (sql: string, params: readonly unknown[]) => void;
}) {
  const app = Fastify({ logger: false });
  openApps.push(app);

  app.decorate('db', {
    query: async (sql: string, params: readonly unknown[] = []) => {
      expect(sql.trim()).toMatch(/^(with|select)\b/i);
      expect(sql).not.toMatch(/\binsert\s+into\b|\bupdate\s+app\.|\bdelete\s+from\b/i);
      options.onQuery?.(sql, params);
      return { rows: options.queryResults ? options.queryResults.shift() ?? [] : options.rows };
    }
  } as unknown as DbPool);
  app.decorate('requireActor', async () => {
    if (options.authenticated === false) {
      throw new ApiError(401, 'unauthenticated', 'Telegram init data is required');
    }

    return managerActor;
  });
  app.decorate('requireTelegramInitData', () => ({
    telegramUserId: managerActor.telegramUserId,
    authDate: new Date()
  }));

  await app.register(errorPlugin);
  await app.register(managerReadModelRoutes);
  return app;
}

describe('manager read-model HTTP routes', () => {
  it('rejects unauthenticated requests using existing project behavior', async () => {
    const app = await buildRouteApp({ rows: [], authenticated: false });
    const response = await app.inject({ method: 'GET', url: '/manager/workplace-state' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('returns forbidden for an employee without can_manage_production', async () => {
    const app = await buildRouteApp({ rows: [] });
    const response = await app.inject({ method: 'GET', url: '/manager/workplace-state' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'forbidden' } });
  });

  it('returns all seven S03-N01 sections for a production manager', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [
        managerRow({
          machine_running_count: '1',
          employee_open_shift_count: '2',
          open_tasks_count: '3'
        })
      ],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({ method: 'GET', url: '/manager/workplace-state' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      section: 'S03',
      screen: 'S03-N01',
      manager: { employee_id: '2', full_name: 'Production Manager' },
      sections: {
        machines: { title: 'Станки', available_actions: expect.arrayContaining(['OPEN_MACHINES']) },
        employees: { title: 'Сотрудники', available_actions: expect.arrayContaining(['OPEN_EMPLOYEES']) },
        downtimes: { title: 'Простои', available_actions: expect.arrayContaining(['OPEN_DOWNTIMES', 'START_CRITICAL_DOWNTIME']) },
        additional_works: { title: 'Доп. работы', available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORKS']) },
        corrections: { title: 'Корректировки', available_actions: expect.arrayContaining(['OPEN_CORRECTIONS']) },
        notifications: { title: 'Уведомления', available_actions: expect.arrayContaining(['OPEN_NOTIFICATIONS']) },
        reports: { title: 'Отчёты', is_placeholder: true, available_actions: [] }
      }
    });
    expect(Object.keys(body.sections)).toEqual([
      'machines',
      'employees',
      'downtimes',
      'additional_works',
      'corrections',
      'notifications',
      'reports'
    ]);
    expect(typeof body.sections.machines.running_count).toBe('number');
    expect(typeof body.sections.employees.open_shift_count).toBe('number');
    expect(typeof body.sections.notifications.open_tasks_count).toBe('number');
    expect(['none', 'operational', 'critical']).toContain(body.sections.machines.downtime_severity);
    expect(['none', 'operational', 'critical']).toContain(body.sections.employees.production_downtime_severity);
    expect(['light_blue', 'grey']).toContain(body.sections.additional_works.ui_variant);
    expect(seenParams).toEqual([['2']]);
  });

  it('returns /manager/machines for a production manager with backend-owned state and actions', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [
          machineRow({
            active_production_operation_id: '100',
            active_employee_id: '20',
            active_employee_full_name: 'Operator',
            active_sku_id: '30',
            active_sku_code: 'SKU-30',
            active_sku_name: 'Part'
          })
        ]
      ],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({ method: 'GET', url: '/manager/machines' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      section: 'S03',
      screen: 'S03-M01',
      title: 'Станки',
      machines: [
        {
          machine_id: '10',
          machine_name: '180 автомат',
          ui_state: 'running',
          ui_variant: 'green',
          active_break_id: null,
          active_downtime_id: null,
          available_actions: expect.arrayContaining(['OPEN_MACHINE_CARD'])
        }
      ],
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(seenParams).toEqual([['2'], []]);
  });

  it('returns /manager/machines/:machine_id card for a production manager', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [
          machineRow({
            active_downtime_id: '500',
            downtime_type: 'critical',
            downtime_name: 'Требуется ремонт',
            downtime_started_at: '2026-07-01 05:00:00+03'
          })
        ]
      ],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({ method: 'GET', url: '/manager/machines/10' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      section: 'S03',
      screen: 'S03-M02',
      machine: {
        machine_id: '10',
        ui_state: 'critical',
        ui_variant: 'red',
        active_downtime_id: '500',
        downtime_started_at: '2026-07-01 05:00:00+03',
        available_actions: expect.arrayContaining(['FINISH_DOWNTIME'])
      },
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(seenParams).toEqual([['2'], ['10']]);
  });

  it('returns /manager/downtimes for a production manager', async () => {
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [
          machineRow({
            active_downtime_id: '501',
            downtime_type: 'operational',
            downtime_name: 'Ожидание материала',
            downtime_comment: null,
            downtime_started_at: '2026-07-01 05:00:00+03'
          })
        ]
      ]
    });
    const response = await app.inject({ method: 'GET', url: '/manager/downtimes' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      section: 'S03',
      screen: 'S03-D01',
      title: 'Простои',
      downtimes: [
        {
          machine_id: '10',
          active_downtime_id: '501',
          downtime_type: 'operational',
          ui_state: 'warning',
          ui_variant: 'yellow',
          available_actions: expect.arrayContaining(['OPEN_MACHINE_CARD'])
        }
      ],
      available_actions: expect.arrayContaining(['START_CRITICAL_DOWNTIME', 'BACK'])
    });
  });

  it('returns forbidden for a non-manager on new manager machines and downtime endpoints', async () => {
    for (const url of ['/manager/machines', '/manager/machines/10', '/manager/downtimes']) {
      const app = await buildRouteApp({ rows: [], queryResults: [[]] });
      const response = await app.inject({ method: 'GET', url });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: 'forbidden' } });
    }
  });

  it('returns /manager/employees for a production manager with backend-owned state and actions', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [
          employeeRow({
            open_shift_id: '900',
            active_production_operation_id: '100',
            active_machine_id: '10',
            active_machine_name: '180 автомат',
            active_sku_id: '30',
            active_sku_code: 'SKU-30',
            active_sku_name: 'Part'
          })
        ]
      ],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({ method: 'GET', url: '/manager/employees' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      section: 'S03',
      screen: 'S03-E01',
      title: 'Сотрудники',
      employees: [
        {
          employee_id: '20',
          full_name: 'Operator',
          ui_state: 'production',
          ui_variant: 'green',
          open_shift_id: '900',
          active_downtime_id: null,
          available_actions: expect.arrayContaining(['OPEN_EMPLOYEE_CARD'])
        }
      ],
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(seenParams).toEqual([['2'], []]);
  });

  it('returns /manager/employees/:employee_id card for a production manager', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [employeeRow({ open_shift_id: '900' })]
      ],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({ method: 'GET', url: '/manager/employees/20' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      section: 'S03',
      screen: 'S03-E02',
      employee: {
        employee_id: '20',
        full_name: 'Operator',
        ui_state: 'shift_idle',
        ui_variant: 'light_blue',
        available_actions: expect.arrayContaining(['VIEW_SALARY', 'VIEW_COMPLETED_WORKS', 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER'])
      },
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(seenParams).toEqual([['2'], ['20']]);
  });

  it('returns selected employee salary and history without using actor employee id as target', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [employeeRow()],
        [{ today_uzs: '10', week_uzs: '20', month_uzs: '30' }],
        [managerIdentityRow()],
        [employeeRow()],
        [
          {
            month: '2026-06-01',
            total_uzs: '30',
            production_uzs: '11',
            additional_work_uzs: '12',
            corrections_uzs: null,
            reversals_uzs: null
          }
        ]
      ],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });

    expect((await app.inject('/manager/employees/20/salary')).json()).toMatchObject({
      section: 'S03',
      screen: 'S03-SAL01',
      employee: { employee_id: '20', full_name: 'Operator' },
      employee_id: '20',
      totals: { today_uzs: 10, week_uzs: 20, month_uzs: 30 }
    });
    expect((await app.inject('/manager/employees/20/salary/history')).json()).toMatchObject({
      section: 'S03',
      screen: 'S03-SAL02',
      employee: { employee_id: '20', full_name: 'Operator' },
      employee_id: '20',
      months: [{ month: '2026-06-01', total_uzs: 30 }]
    });
    expect(seenParams).toEqual([['2'], ['20'], ['20'], ['2'], ['20'], ['20']]);
  });

  it('returns forbidden for a non-manager on manager employee and salary endpoints', async () => {
    for (const url of [
      '/manager/employees',
      '/manager/employees/20',
      '/manager/employees/20/salary',
      '/manager/employees/20/salary/history'
    ]) {
      const app = await buildRouteApp({ rows: [], queryResults: [[]] });
      const response = await app.inject({ method: 'GET', url });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: 'forbidden' } });
    }
  });

  it('returns /manager/additional-works for a production manager with backend-owned groups and actions', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [
          additionalWorkRow(),
          additionalWorkRow({ additional_work_id: '701', status: 'active', started_at: '2026-07-01 09:00:00+03' })
        ]
      ],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({ method: 'GET', url: '/manager/additional-works' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      section: 'S03',
      screen: 'S03-AW01',
      title: 'Доп. работы',
      groups: {
        requested: [
          {
            additional_work_id: '700',
            status: 'requested',
            ui_state: 'requested',
            ui_variant: 'grey',
            available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORK_CARD', 'APPROVE_ADDITIONAL_WORK_REQUEST', 'REJECT_ADDITIONAL_WORK_REQUEST'])
          }
        ],
        approved: [],
        active: [
          {
            additional_work_id: '701',
            status: 'active',
            ui_state: 'active',
            ui_variant: 'green',
            available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORK_CARD'])
          }
        ],
        waiting_accrual: []
      },
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(seenParams).toEqual([['2'], []]);
  });

  it('keeps the legacy type catalog compatible and exposes assignability only for a selected employee', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [
        [managerIdentityRow()],
        [{ additional_work_type_id: '10', display_name: 'Упаковка' }],
        [managerIdentityRow()],
        [{
          additional_work_type_id: '10',
          display_name: 'Упаковка',
          is_active: true,
          can_assign: false,
          blocked_code: 'additional_work_assignment_already_exists'
        }]
      ],
      onQuery: (_sql, params) => seenParams.push(params)
    });

    const legacy = await app.inject({
      method: 'GET',
      url: '/manager/additional-work-types/available'
    });
    expect(legacy.statusCode).toBe(200);
    expect(legacy.json()).toEqual({
      section: 'S03',
      screen: 'S03-AW41',
      additional_work_types: [{
        additional_work_type_id: '10',
        additional_work_name: 'Упаковка',
        is_active: true,
        display_order: 1
      }],
      available_actions: ['BACK']
    });

    const selected = await app.inject({
      method: 'GET',
      url: '/manager/additional-work-types/available?employee_id=20'
    });
    expect(selected.statusCode).toBe(200);
    expect(selected.json()).toMatchObject({
      assignability_employee_id: '20',
      assignability_additional_work_type_id: null,
      additional_work_types: [{
        additional_work_type_id: '10',
        can_assign: false,
        blocked_code: 'additional_work_assignment_already_exists',
        blocked_message: 'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.'
      }],
      available_actions: ['BACK']
    });
    expect(seenParams).toEqual([['2'], [], ['2'], ['20', null]]);
  });

  it('rejects an invalid assignability employee id before a database read', async () => {
    const app = await buildRouteApp({ rows: [] });
    const response = await app.inject({
      method: 'GET',
      url: '/manager/additional-work-types/available?employee_id=0'
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'bad_request' } });
  });

  it('returns /manager/notifications/open-tasks with count matching row length and no mutation actions', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [],
      queryResults: [[managerIdentityRow()], [
        {
          task_kind: 'ADDITIONAL_WORK_REQUESTED', source_table: 'additional_works', source_id: '700',
          source_started_at: '2026-07-01 08:00:00+03', sort_group: '4',
          additional_work_name: 'Упаковка', employee_full_name: 'Operator', machine_id: null,
          machine_name: null, downtime_name: null, elapsed_minutes: null
        },
        {
          task_kind: 'CRITICAL_DOWNTIME_OPEN', source_table: 'machine_downtimes', source_id: '901',
          source_started_at: '2026-07-01 07:00:00+03', sort_group: '1',
          additional_work_name: null, employee_full_name: null, machine_id: '10',
          machine_name: '180 автомат', downtime_name: 'Ремонт', elapsed_minutes: '60'
        }
      ]],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({ method: 'GET', url: '/manager/notifications/open-tasks' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      section: 'S03',
      screen: 'S03-NOT01',
      title: 'Уведомления',
      open_tasks_count: 2,
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(body.open_tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        task_kind: 'ADDITIONAL_WORK_REQUESTED',
        source_table: 'additional_works',
        task_type: 'additional_work_request',
        ui_state: 'open',
        ui_variant: 'grey',
        available_actions: expect.arrayContaining(['OPEN_TASK_SOURCE'])
      }),
      expect.objectContaining({
        task_kind: 'CRITICAL_DOWNTIME_OPEN',
        source_table: 'machine_downtimes',
        task_type: 'open_machine_downtime',
        available_actions: expect.arrayContaining(['OPEN_TASK_SOURCE'])
      })
    ]));
    expect(JSON.stringify(body)).not.toMatch(/READ|HIDE|CANCEL/);
    expect(body.open_tasks_count).toBe(body.open_tasks.length);
    expect(seenParams.filter((params) => params.length > 0)).toEqual([['2']]);
  });

  it('returns forbidden for a non-manager on manager additional work and open task endpoints', async () => {
    for (const url of ['/manager/additional-works', '/manager/notifications/open-tasks']) {
      const app = await buildRouteApp({ rows: [], queryResults: [[]] });
      const response = await app.inject({ method: 'GET', url });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: 'forbidden' } });
    }
  });
});
