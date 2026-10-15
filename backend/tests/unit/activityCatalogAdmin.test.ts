import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import { adminCatalogRoutes } from '../../src/routes/adminCatalog.js';

const actor: ActorContext = { employeeId: 7n, telegramUserId: 1000n };
const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function buildApp(
  rowsByQuery: Array<readonly Record<string, unknown>[]>,
  observe: (sql: string, params: readonly unknown[]) => void
): Promise<FastifyInstance> {
  const queue = [...rowsByQuery];
  const app = Fastify({ logger: false });
  openApps.push(app);
  app.decorate('db', {
    query: async (sql: string, params: readonly unknown[] = []) => {
      observe(sql, params);
      return { rows: queue.shift() ?? [] };
    }
  } as unknown as DbPool);
  app.decorate('requireActor', async () => actor);
  app.decorate('requireTelegramInitData', () => ({ telegramUserId: actor.telegramUserId, authDate: new Date() }));
  await app.register(errorPlugin);
  await app.register(adminCatalogRoutes);
  return app;
}

describe('activity catalog admin routes', () => {
  it('keeps operational type creation in the operational runtime scope', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = await buildApp([[{ result: '42' }]], (sql, params) => calls.push({ sql, params }));
    const response = await app.inject({
      method: 'POST',
      url: '/admin/machine-downtime-types/operational',
      payload: {
        technical_code: 'parts_waiting',
        display_name: 'Ожидание комплектующих',
        display_order: 30,
        behavior_profile_id: '3',
        reason: 'Добавление вида'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: '42' });
    expect(calls).toEqual([{
      sql: 'select app.create_operational_downtime_type($1, $2, $3, $4, $5, $6) as result',
      params: ['7', 'parts_waiting', 'Ожидание комплектующих', 30, '3', 'Добавление вида']
    }]);
  });

  it('keeps critical profile creation in the critical runtime scope with explicit status effect', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = await buildApp([[{ result: '44' }]], (sql, params) => calls.push({ sql, params }));
    const response = await app.inject({
      method: 'POST',
      url: '/admin/machine-downtime-profiles/critical',
      payload: {
        technical_code: 'critical_electrical_v1',
        profile_name: 'Критическая электрика v1',
        operator_requires_start_comment: true,
        blocks_production_finish: false,
        blocks_shift_finish: false,
        machine_status_effect: 'BROKEN',
        reason: 'Новая версия профиля'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(calls[0]).toEqual({
      sql: 'select app.create_critical_downtime_behavior_profile($1, $2, $3, $4, $5, $6, $7, $8) as result',
      params: ['7', 'critical_electrical_v1', 'Критическая электрика v1', true, false, false, 'BROKEN', 'Новая версия профиля']
    });
  });

  it('reads only the requested class after database-projected dictionary permission', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = await buildApp(
      [
        [{ can_manage_dictionaries: true }],
        [{ downtime_type_id: '8', downtime_class: 'CRITICAL', display_name: 'Авария электрики' }]
      ],
      (sql, params) => calls.push({ sql, params })
    );
    const response = await app.inject('/admin/machine-downtime-types/critical');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ types: [{ downtime_type_id: '8', downtime_class: 'CRITICAL' }] });
    expect(calls[0]?.sql).toContain('r.can_manage_dictionaries');
    expect(calls[0]?.params).toEqual(['7']);
    expect(calls[1]?.sql).toContain('where mdt.downtime_class = $1');
    expect(calls[1]?.params).toEqual(['CRITICAL']);
  });

  it('rejects a catalog read without can_manage_dictionaries', async () => {
    const app = await buildApp([[{ can_manage_dictionaries: false }]], () => undefined);
    const response = await app.inject('/admin/operator-break-types');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'forbidden' } });
  });

  it('rejects malformed technical codes before any runtime call', async () => {
    let queryCount = 0;
    const app = await buildApp([], () => { queryCount += 1; });
    const response = await app.inject({
      method: 'POST',
      url: '/admin/operator-break-types',
      payload: {
        technical_code: 'Bad Code',
        display_name: 'Неверный вид',
        display_order: 1,
        behavior_profile_id: '1',
        reason: 'Негативная проверка'
      }
    });
    expect(response.statusCode).toBe(400);
    expect(queryCount).toBe(0);
  });
});
