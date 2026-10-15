import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ActorContext } from '../../src/auth/actorContext.js';
import { ApiError } from '../../src/db/errors.js';
import type { DbPool } from '../../src/db/pool.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import { operatorReadModelRoutes } from '../../src/routes/operatorReadModels.js';

const actor: ActorContext = {
  employeeId: 7n,
  telegramUserId: 1000n
};

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function workplaceRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    employee_full_name: 'Иванов Иван Иванович',
    employee_shift_id: null,
    shift_started_at: null,
    production_operation_id: null,
    production_machine_id: null,
    production_machine_name: null,
    sku_id: null,
    sku_code: null,
    sku_name: null,
    linked_downtime_id: null,
    linked_downtime_production_operation_id: null,
    linked_downtime_machine_id: null,
    linked_downtime_machine_name: null,
    linked_downtime_type_id: null,
    linked_downtime_type_name: null,
    linked_downtime_class: null,
    operator_break_id: null,
    break_type_id: null,
    break_type_name: null,
    active_additional_work_id: null,
    active_additional_work_name: null,
    approved_unstarted_count: '0',
    ...overrides
  };
}

async function buildRouteApp(options: {
  rows: Array<readonly Record<string, unknown>[]>;
  authenticated?: boolean;
  onQuery?: (sql: string, params: readonly unknown[]) => void;
}) {
  const queue = [...options.rows];
  const app = Fastify({ logger: false });
  openApps.push(app);

  app.decorate('db', {
    query: async (sql: string, params: readonly unknown[] = []) => {
      expect(sql.trim()).toMatch(/^(select|with)\b/i);
      expect(sql).not.toMatch(/\binsert\s+into\b|\bupdate\s+app\.|\bdelete\s+from\b/i);
      options.onQuery?.(sql, params);
      const rows = queue.shift();
      if (!rows) {
        throw new Error(`Unexpected query: ${sql}`);
      }
      return { rows };
    }
  } as unknown as DbPool);
  app.decorate('requireActor', async () => {
    if (options.authenticated === false) {
      throw new ApiError(401, 'unauthenticated', 'Telegram init data is required');
    }

    return actor;
  });
  app.decorate('requireTelegramInitData', () => ({
    telegramUserId: actor.telegramUserId,
    authDate: new Date()
  }));

  await app.register(errorPlugin);
  await app.register(operatorReadModelRoutes);
  return app;
}

describe('operator read-model HTTP routes', () => {
  it.each([
    '/operator/workplace-state',
    '/operator/additional-work-state',
    '/operator/additional-work-types/available',
    '/operator/downtime-types/available',
    '/operator/machines',
    '/operator/skus',
    '/operator/break-types',
    '/operator/salary',
    '/operator/salary/history'
  ])('rejects unauthenticated request for %s', async (url) => {
    const app = await buildRouteApp({ rows: [], authenticated: false });
    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('rejects an unauthenticated QR resolution request', async () => {
    const app = await buildRouteApp({ rows: [], authenticated: false });
    const response = await app.inject({
      method: 'POST',
      url: '/operator/machines/resolve-qr',
      payload: { qr_payload: `peaks-machine:v1:${'A'.repeat(32)}` }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('rejects an unauthenticated SKU QR resolution request', async () => {
    const app = await buildRouteApp({ rows: [], authenticated: false });
    const response = await app.inject({
      method: 'POST',
      url: '/operator/skus/resolve-qr',
      payload: { qr_payload: `peaks-sku:v1:${'A'.repeat(32)}` }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('uses authenticated actor identity and ignores arbitrary employee_id query', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [[workplaceRow()]],
      onQuery: (_sql, params) => {
        seenParams.push(params);
      }
    });
    const response = await app.inject({
      method: 'GET',
      url: '/operator/workplace-state?employee_id=99'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      actor_employee_id: '7',
      available_pipelines: ['START_SHIFT', 'VIEW_SALARY']
    });
    expect(seenParams).toEqual([['7']]);
  });

  it('scopes available additional-work types to the actor and excludes unfinished assignments', async () => {
    const seenQueries: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = await buildRouteApp({
      rows: [[{ additional_work_type_id: '10', display_name: 'Packing' }]],
      onQuery: (sql, params) => {
        seenQueries.push({ sql, params });
      }
    });

    const response = await app.inject('/operator/additional-work-types/available?employee_id=99');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      additional_work_types: [{ additional_work_type_id: '10', display_name: 'Packing' }]
    });
    expect(seenQueries).toHaveLength(1);
    expect(seenQueries[0]?.params).toEqual(['7']);
    expect(seenQueries[0]?.sql).toMatch(/not exists/i);
    expect(seenQueries[0]?.sql).toMatch(/aw\.is_assignment_finished = false/i);
  });

  it('returns accepted wrappers and bigint-safe strings for all read endpoints', async () => {
    const app = await buildRouteApp({
      rows: [
        [
          workplaceRow({
            employee_shift_id: '11',
            production_operation_id: '22',
            production_machine_id: '33',
            production_machine_name: 'Machine A',
            sku_id: '44',
            sku_code: 'SKU-1',
            sku_name: null
          })
        ],
        [
          {
            additional_work_id: '1',
            additional_work_type_id: '10',
            display_name: 'Run',
            assigned_by_employee_id: '7',
            employee_id: '7',
            is_pending: false,
            is_approved: true,
            started_at: '2026-06-09T08:00:00.000Z',
            finished_at: null,
            cancelled_at: null,
            is_assignment_finished: false
          }
        ],
        [{ additional_work_type_id: '10', display_name: 'Packing' }],
        [{ production_operation_id: '22' }],
        [
          {
            downtime_type_id: '2',
            display_name: 'Critical display',
            downtime_class: 'CRITICAL',
            ui_color_token: 'scarlet',
            requires_production_operation: false,
            operator_requires_start_comment: true
          }
        ],
        [
          {
            machine_id: '33',
            machine_name: 'Machine A',
            workshop_name: null,
            machine_status: null,
            machine_use_status: null,
            is_available_for_operations: true,
            is_decommissioned: false,
            is_available_for_start: true,
            is_running_status: false,
            is_downtime_status: false,
            is_broken_status: false,
            has_open_production: false,
            has_open_production_by_actor: false,
            has_open_downtime: false,
            has_open_critical_downtime: false,
            active_production_employee_full_name: null
          }
        ],
        [
          {
            machine_id: '33',
            machine_name: 'Machine A',
            workshop_name: 'Workshop',
            machine_status: 'Ready',
            machine_use_status: 'Available',
            is_available_for_operations: true,
            is_decommissioned: false,
            is_available_for_start: true,
            is_running_status: false,
            is_downtime_status: false,
            is_broken_status: false,
            has_open_production: false,
            has_open_production_by_actor: false,
            has_open_downtime: false,
            has_open_critical_downtime: false,
            active_production_employee_full_name: null
          }
        ],
        [
          {
            sku_id: '44',
            sku_code: 'SKU-1',
            sku_name: null,
            sku_unit_name: null,
            current_sku_tariff_uzs: '100.0000',
            is_active: true
          }
        ],
        [{ break_type_id: '5', display_name: 'Break' }],
        [
          {
            today_uzs: '10',
            week_uzs: '20',
            month_uzs: '30'
          }
        ],
        [
          {
            month: '2026-06-01',
            total_uzs: '30',
            production_uzs: '11',
            additional_work_uzs: '12',
            corrections_uzs: '13',
            reversals_uzs: '-1'
          }
        ]
      ]
    });

    expect((await app.inject('/operator/workplace-state')).json()).toMatchObject({
      actor_employee_id: '7',
      production: { production_operation_id: '22', sku_name: 'SKU-1' }
    });
    expect((await app.inject('/operator/additional-work-state')).json()).toHaveProperty('active_additional_works');
    expect((await app.inject('/operator/additional-work-types/available')).json()).toEqual({
      additional_work_types: [{ additional_work_type_id: '10', display_name: 'Packing' }]
    });
    expect((await app.inject('/operator/downtime-types/available')).json()).toMatchObject({
      active_production_operation_id: '22',
      available_downtime_types: [{ ui_color_token: 'scarlet', requires_comment: true }]
    });
    expect((await app.inject('/operator/machines')).json()).toMatchObject({
      machines: [{ machine_id: '33', machine_status: null, machine_use_status: null }]
    });
    expect((await app.inject({
      method: 'POST',
      url: '/operator/machines/resolve-qr',
      payload: { qr_payload: `peaks-machine:v1:${'A'.repeat(32)}` }
    })).json()).toMatchObject({
      found: true,
      machine: { machine_id: '33', production_unavailability: null }
    });
    expect((await app.inject('/operator/skus')).json()).toMatchObject({
      skus: [{ sku_id: '44', sku_name: 'SKU-1', sku_unit_name: null, current_sku_tariff_uzs: 100 }]
    });
    expect((await app.inject('/operator/break-types')).json()).toEqual({
      break_types: [{ break_type_id: '5', display_name: 'Break' }]
    });
    const salaryResponse = (await app.inject('/operator/salary')).json();
    expect(salaryResponse).toMatchObject({
      employee_id: '7',
      totals: { today_uzs: 10, week_uzs: 20, month_uzs: 30 }
    });
    expect(salaryResponse).not.toHaveProperty('breakdown');
    expect((await app.inject('/operator/salary/history')).json()).toMatchObject({
      employee_id: '7',
      months: [{ month: '2026-06-01', total_uzs: 30 }]
    });
  });

  it('validates the fixed-path QR body and returns exact QR not-found response', async () => {
    const invalidApp = await buildRouteApp({ rows: [] });
    const invalid = await invalidApp.inject({
      method: 'POST',
      url: '/operator/machines/resolve-qr',
      payload: { qr_payload: '   ' }
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { code: 'bad_request' } });

    const unrelatedApp = await buildRouteApp({ rows: [] });
    const unrelated = await unrelatedApp.inject({
      method: 'POST',
      url: '/operator/machines/resolve-qr',
      payload: { qr_payload: 'https://example.invalid/not-a-machine-label' }
    });
    expect(unrelated.statusCode).toBe(200);
    expect(unrelated.json()).toEqual({ found: false, error_code: 'MACHINE_QR_NOT_FOUND' });

    const seenParams: Array<readonly unknown[]> = [];
    const token = 'B'.repeat(32);
    const checkedNotFoundApp = await buildRouteApp({
      rows: [[]],
      onQuery: (_sql, params) => seenParams.push(params)
    });
    const notFound = await checkedNotFoundApp.inject({
      method: 'POST',
      url: '/operator/machines/resolve-qr',
      payload: { qr_payload: `peaks-machine:v1:${token}` }
    });
    expect(notFound.statusCode).toBe(200);
    expect(notFound.json()).toEqual({ found: false, error_code: 'MACHINE_QR_NOT_FOUND' });
    expect(seenParams).toEqual([['7', token]]);
  });

  it('resolves an active SKU QR and explains inactive or unknown labels', async () => {
    const token = 'C'.repeat(32);
    const seenParams: Array<readonly unknown[]> = [];
    const activeApp = await buildRouteApp({
      rows: [[{
        sku_id: '44',
        sku_code: 'SKU-1',
        sku_name: null,
        sku_unit_name: 'шт.',
        current_sku_tariff_uzs: '100.0000',
        is_active: true,
        sku_unit_is_active: true
      }]],
      onQuery: (_sql, params) => seenParams.push(params)
    });
    const active = await activeApp.inject({
      method: 'POST',
      url: '/operator/skus/resolve-qr',
      payload: { qr_payload: `peaks-sku:v1:${token}` }
    });
    expect(active.statusCode).toBe(200);
    expect(active.json()).toEqual({
      found: true,
      sku: {
        sku_id: '44',
        sku_code: 'SKU-1',
        sku_name: 'SKU-1',
        sku_unit_name: 'шт.',
        current_sku_tariff_uzs: 100,
        is_active: true,
        is_selectable_for_production: true,
        production_unavailability: null
      }
    });
    expect(seenParams).toEqual([[token]]);

    const inactiveApp = await buildRouteApp({ rows: [[{
      sku_id: '45', sku_code: 'SKU-2', sku_name: 'Name', sku_unit_name: 'шт.',
      current_sku_tariff_uzs: '0', is_active: false, sku_unit_is_active: true
    }]] });
    expect((await inactiveApp.inject({
      method: 'POST', url: '/operator/skus/resolve-qr',
      payload: { qr_payload: `peaks-sku:v1:${'D'.repeat(32)}` }
    })).json()).toMatchObject({
      found: true,
      sku: { is_selectable_for_production: false, production_unavailability: { code: 'SKU_INACTIVE' } }
    });

    const unknownApp = await buildRouteApp({ rows: [[]] });
    expect((await unknownApp.inject({
      method: 'POST', url: '/operator/skus/resolve-qr',
      payload: { qr_payload: 'not-a-sku-label' }
    })).json()).toEqual({ found: false, error_code: 'SKU_QR_NOT_FOUND' });
  });

  it('passes the authenticated employee to machine availability reads', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const app = await buildRouteApp({
      rows: [[]],
      onQuery: (_sql, params) => seenParams.push(params),
    });

    const response = await app.inject('/operator/machines');
    expect(response.statusCode).toBe(200);
    expect(seenParams).toEqual([['7', null]]);
  });

  it('does not accept frontend-controlled business-state parameters', async () => {
    const seenSql: string[] = [];
    const app = await buildRouteApp({
      rows: [[workplaceRow()]],
      onQuery: (sql, params) => {
        seenSql.push(sql);
        expect(params).toEqual(['7']);
      }
    });
    const response = await app.inject({
      method: 'GET',
      url: '/operator/workplace-state?downtime_class=CRITICAL&available_pipelines=FINISH_SHIFT'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ actor_employee_id: '7' });
    expect(seenSql.join('\n')).not.toMatch(/available_pipelines/);
    expect(seenSql.join('\n')).toContain('mdbp.downtime_class as linked_downtime_class');
  });
});
