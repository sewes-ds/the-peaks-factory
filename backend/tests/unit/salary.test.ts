import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ActorContext } from '../../src/auth/actorContext.js';
import { ApiError } from '../../src/db/errors.js';
import type { DbPool } from '../../src/db/pool.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import {
  adaptProductionCorrectionRuntimeParams,
  exactProductionQuantityDelta,
  parseSalaryPart,
  salaryRoutes
} from '../../src/routes/salary.js';
import { callSalaryRuntime, createAndApproveSalaryRuntime } from '../../src/services/salary.js';

const actor: ActorContext = {
  employeeId: 7n,
  telegramUserId: 1000n
};

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function createPool(expectedSql: string, expectedParams: readonly unknown[]): DbPool {
  return {
    query: async (sql: string, params: readonly unknown[]) => {
      expect(sql).toBe(expectedSql);
      expect(params).toEqual(expectedParams);
      return { rows: [{ result: '42' }] };
    }
  } as unknown as DbPool;
}

describe('salary service', () => {
  it('creates salary correction through approved runtime_api without calculation', async () => {
    await expect(
      callSalaryRuntime(
        createPool('select app.create_salary_correction($1, $2, $3, $4, $5, $6) as result', ['7', '10', '11', '12', '1000', 'reason']),
        actor,
        'create_salary_correction',
        ['10', '11', '12', '1000', 'reason']
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('reverses salary entry through approved runtime_api', async () => {
    await expect(
      callSalaryRuntime(
        createPool('select app.reverse_salary_entry($1, $2, $3) as result', ['7', '99', 'reason']),
        actor,
        'reverse_salary_entry',
        ['99', 'reason']
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('creates and approves a correction in one transaction', async () => {
    const calls: Array<readonly unknown[]> = [];
    const release = vi.fn();
    const client = {
      query: vi.fn(async (sql: string, params?: readonly unknown[]) => {
        calls.push([sql, ...(params ?? [])]);
        if (sql.includes('create_salary_correction')) return { rows: [{ result: '42' }] };
        if (sql.includes('approve_salary_correction')) return { rows: [{ result: '77' }] };
        return { rows: [] };
      }),
      release
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as DbPool;

    await expect(createAndApproveSalaryRuntime(
      pool,
      actor,
      'create_salary_correction',
      'approve_salary_correction',
      ['10', '11', '12', '1000', 'reason']
    )).resolves.toEqual({ id: '42' });

    expect(calls).toEqual([
      ['begin'],
      ['select app.create_salary_correction($1, $2, $3, $4, $5, $6) as result', '7', '10', '11', '12', '1000', 'reason'],
      ['select app.approve_salary_correction($1, $2) as result', '7', '42'],
      ['commit']
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('rolls back the created correction when approval fails', async () => {
    const calls: string[] = [];
    const release = vi.fn();
    const client = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql);
        if (sql.includes('create_production_operation_correction')) return { rows: [{ result: '42' }] };
        if (sql.includes('approve_production_operation_correction')) throw Object.assign(new Error('denied'), { code: 'P0001' });
        return { rows: [] };
      }),
      release
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as DbPool;

    await expect(createAndApproveSalaryRuntime(
      pool,
      actor,
      'create_production_operation_correction',
      'approve_production_operation_correction',
      ['99', '2', null, 'reason']
    )).rejects.toMatchObject({ statusCode: 409, code: 'conflict' });

    expect(calls.at(-1)).toBe('rollback');
    expect(calls).not.toContain('commit');
    expect(release).toHaveBeenCalledOnce();
  });
});

describe('salary route validation', () => {
  it('maps invalid request parts to API bad request', () => {
    expect(() => parseSalaryPart(z.object({ id: z.string().regex(/^[1-9][0-9]*$/) }), { id: '0' })).toThrow(
      'Invalid salary request'
    );
  });
});

describe('production correction quantity adapter', () => {
  it.each([
    ['10', '12', '2'],
    ['12', '10', '-2'],
    ['10.125', '10.375', '0.25'],
    ['10.375', '10.125', '-0.25'],
    ['0', '0.125', '0.125'],
    ['999999999999999999999.1', '1000000000000000000000.1', '1'],
    ['10.50', '12.5000', '2'],
    ['1000000000000000000000000000000.0001', '0', '-1000000000000000000000000000000.0001']
  ])('computes %s -> %s exactly as canonical delta %s', (oldQuantity, newQuantity, expectedDelta) => {
    expect(exactProductionQuantityDelta(oldQuantity, newQuantity)).toBe(expectedDelta);
  });

  it('preserves the public old/new request while adapting the exact DB tuple', () => {
    const body = {
      production_operation_id: '42',
      old_quantity: '10.125',
      new_quantity: '10.375',
      reason: 'verified reason'
    };
    const snapshot = { ...body };

    expect(adaptProductionCorrectionRuntimeParams(body)).toEqual(['42', '0.25', null, 'verified reason']);
    expect(body).toEqual(snapshot);
  });

  it('rejects equal numeric values before a DB tuple can be produced', () => {
    expect(() => exactProductionQuantityDelta('10.0', '10.000')).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'bad_request',
        message: 'Production correction must change quantity'
      })
    );
  });

  it.each(['-1', '+1', '01', '.5', '1.', '1,5', '1e3', 'NaN', 'Infinity', ' 1']) (
    'rejects invalid decimal input %s deterministically',
    (invalidQuantity) => {
      expect(() => exactProductionQuantityDelta(invalidQuantity, '2')).toThrow(
        expect.objectContaining({ statusCode: 400, code: 'bad_request', message: 'Invalid salary request' })
      );
    }
  );
});

describe('production correction HTTP route', () => {
  async function buildRouteApp(authenticated = true) {
    const query = vi.fn(async () => ({ rows: [{ result: '91' }] }));
    const requireActor = vi.fn(async () => {
      if (!authenticated) {
        throw new ApiError(401, 'unauthenticated', 'Telegram init data is required');
      }
      return actor;
    });
    const app = Fastify({ logger: false });
    openApps.push(app);
    app.decorate('db', { query } as unknown as DbPool);
    app.decorate('requireActor', requireActor);
    app.decorate('requireTelegramInitData', () => ({ telegramUserId: actor.telegramUserId, authDate: new Date() }));
    await app.register(errorPlugin);
    await app.register(salaryRoutes);
    return { app, query, requireActor };
  }

  it('keeps the response shape and calls DB with +2 quantity delta plus null amount delta', async () => {
    const { app, query } = await buildRouteApp();
    const response = await app.inject({
      method: 'POST',
      url: '/production-operation-corrections',
      payload: {
        production_operation_id: '99',
        old_quantity: '10',
        new_quantity: '12',
        reason: '  fix  '
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: '91' });
    expect(query).toHaveBeenCalledExactlyOnceWith(
      'select app.create_production_operation_correction($1, $2, $3, $4, $5) as result',
      ['7', '99', '2', null, 'fix']
    );
    expect(query).not.toHaveBeenCalledWith(expect.anything(), ['7', '99', '10', '12', 'fix']);
  });

  it('calls DB with -2 quantity delta plus null amount delta', async () => {
    const { app, query } = await buildRouteApp();
    const response = await app.inject({
      method: 'POST',
      url: '/production-operation-corrections',
      payload: { production_operation_id: '99', old_quantity: '12', new_quantity: '10', reason: 'fix' }
    });

    expect(response.statusCode).toBe(200);
    expect(query).toHaveBeenCalledExactlyOnceWith(
      'select app.create_production_operation_correction($1, $2, $3, $4, $5) as result',
      ['7', '99', '-2', null, 'fix']
    );
  });

  it.each([
    ['10.125', '10.375', '0.25'],
    ['10.375', '10.125', '-0.25']
  ])('passes exact fractional correction %s -> %s as canonical DB delta %s', async (oldQuantity, newQuantity, expectedDelta) => {
    const { app, query } = await buildRouteApp();
    const response = await app.inject({
      method: 'POST',
      url: '/production-operation-corrections',
      payload: { production_operation_id: '99', old_quantity: oldQuantity, new_quantity: newQuantity, reason: 'fraction' }
    });

    expect(response.statusCode).toBe(200);
    expect(query).toHaveBeenCalledExactlyOnceWith(
      'select app.create_production_operation_correction($1, $2, $3, $4, $5) as result',
      ['7', '99', expectedDelta, null, 'fraction']
    );
  });

  it('rejects zero delta before any DB call', async () => {
    const { app, query } = await buildRouteApp();
    const response = await app.inject({
      method: 'POST',
      url: '/production-operation-corrections',
      payload: { production_operation_id: '42', old_quantity: '1.0', new_quantity: '1.000', reason: 'same' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: 'bad_request', message: 'Production correction must change quantity' }
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, unknown>]>([
    ['negative old', { old_quantity: '-1' }],
    ['negative new', { new_quantity: '-1' }],
    ['leading zero', { old_quantity: '01' }],
    ['explicit plus', { old_quantity: '+1' }],
    ['missing integer', { old_quantity: '.5' }],
    ['missing fraction', { old_quantity: '1.' }],
    ['comma decimal', { old_quantity: '1,5' }],
    ['exponent', { old_quantity: '1e3' }],
    ['NaN', { old_quantity: 'NaN' }],
    ['Infinity', { old_quantity: 'Infinity' }],
    ['whitespace', { old_quantity: ' 1' }],
    ['number value', { old_quantity: 1 }],
    ['blank reason', { reason: '   ' }],
    ['invalid production operation ID', { production_operation_id: '0' }]
  ])('rejects %s before any DB call', async (_label, override) => {
    const { app, query } = await buildRouteApp();
    const response = await app.inject({
      method: 'POST',
      url: '/production-operation-corrections',
      payload: { production_operation_id: '42', old_quantity: '1', new_quantity: '2', reason: 'invalid', ...override }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'bad_request', message: 'Invalid salary request' } });
    expect(query).not.toHaveBeenCalled();
  });

  it('preserves the existing requireActor guard before validation and DB access', async () => {
    const { app, query, requireActor } = await buildRouteApp(false);
    const response = await app.inject({
      method: 'POST',
      url: '/production-operation-corrections',
      payload: { production_operation_id: '99', old_quantity: '10', new_quantity: '12', reason: 'fix' }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: 'unauthenticated', message: 'Telegram init data is required' } });
    expect(requireActor).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('atomic correction HTTP routes', () => {
  async function buildAtomicApp(failApproval = false) {
    const calls: Array<Readonly<{ sql: string; params: readonly unknown[] }>> = [];
    const release = vi.fn();
    const client = {
      query: vi.fn(async (sql: string, params: readonly unknown[] = []) => {
        calls.push({ sql, params });
        if (sql.includes('approve_') && failApproval) {
          throw Object.assign(new Error('approval failed'), { code: 'P0001' });
        }
        if (sql.startsWith('select app.create_')) return { rows: [{ result: '91' }] };
        if (sql.startsWith('select app.approve_')) return { rows: [{ result: '92' }] };
        return { rows: [] };
      }),
      release
    };
    const app = Fastify({ logger: false });
    openApps.push(app);
    app.decorate('db', { connect: vi.fn(async () => client) } as unknown as DbPool);
    app.decorate('requireActor', vi.fn(async () => actor));
    app.decorate('requireTelegramInitData', () => ({ telegramUserId: actor.telegramUserId, authDate: new Date() }));
    await app.register(errorPlugin);
    await app.register(salaryRoutes);
    return { app, calls, release };
  }

  it('applies salary correction with create and approve inside one transaction', async () => {
    const { app, calls, release } = await buildAtomicApp();
    const response = await app.inject({
      method: 'POST',
      url: '/salary-corrections/apply',
      payload: {
        employee_id: '10', employee_shift_id: '11', salary_correction_type_id: '12',
        amount: '-500', reason: '  исправление  '
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: '91' });
    expect(calls).toEqual([
      { sql: 'begin', params: [] },
      { sql: 'select app.create_salary_correction($1, $2, $3, $4, $5, $6) as result', params: ['7', '10', '11', '12', '-500', 'исправление'] },
      { sql: 'select app.approve_salary_correction($1, $2) as result', params: ['7', '91'] },
      { sql: 'commit', params: [] }
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('applies production correction atomically and rolls back when approval fails', async () => {
    const { app, calls, release } = await buildAtomicApp(true);
    const response = await app.inject({
      method: 'POST',
      url: '/production-operation-corrections/apply',
      payload: { production_operation_id: '99', old_quantity: '10', new_quantity: '12', reason: 'fix' }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'conflict', message: 'Operation violates current business state' } });
    expect(calls.map(({ sql }) => sql)).toEqual([
      'begin',
      'select app.create_production_operation_correction($1, $2, $3, $4, $5) as result',
      'select app.approve_production_operation_correction($1, $2) as result',
      'rollback'
    ]);
    expect(calls.some(({ sql }) => sql === 'commit')).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
});
