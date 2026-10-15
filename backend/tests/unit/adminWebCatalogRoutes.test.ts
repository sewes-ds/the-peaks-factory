import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { DbPool } from '../../src/db/pool.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import { adminWebCatalogRoutes } from '../../src/routes/adminWebCatalog.js';

const actor = {
  session_id: '11',
  employee_id: '7',
  full_name: 'Иванов И.И.',
  role_name: 'Директор',
  auth_method: 'PASSWORD' as const,
  must_change_password: false,
  created_at: '2026-08-29T12:00:00.000Z',
  idle_expires_at: '2026-08-29T12:30:00.000Z',
  expires_at: '2026-08-29T20:00:00.000Z',
  sessionTokenHash: 'a'.repeat(64),
  csrfTokenHash: 'b'.repeat(64)
};

describe('admin web catalog routes', () => {
  it('generates a protected machine QR token server-side and does not return it', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const mutationOptions: unknown[] = [];
    const app = Fastify({ logger: false });
    app.decorate('requireAdminActor', async (_request: unknown, options: unknown) => {
      mutationOptions.push(options);
      return actor;
    });
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        calls.push({ sql, params });
        return { rows: [{ result: { machine_id: '15', created: true, qr_rotated: true } }] };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminWebCatalogRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/catalog/machines',
      payload: {
        machine_name: 'Станок №15',
        workshop_name: 'Основной цех',
        machine_use_status_id: '1',
        rotate_qr: false,
        reason: 'Добавление нового станка'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(mutationOptions).toEqual([{ mutation: true }]);
    expect(calls[0]?.sql).toContain('save_admin_machine(');
    expect(calls[0]?.params.slice(0, 5)).toEqual([
      'a'.repeat(64),
      null,
      'Станок №15',
      'Основной цех',
      '1'
    ]);
    expect(calls[0]?.params[5]).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(calls[0]?.params[6]).toBe('Добавление нового станка');
    expect(response.json()).toEqual({
      result: { machine_id: '15', created: true, qr_rotated: true }
    });
    expect(response.body).not.toContain(String(calls[0]?.params[5]));
  });

  it('rejects malformed catalog input before touching the database', async () => {
    let queryCount = 0;
    const app = Fastify({ logger: false });
    app.decorate('requireAdminActor', async () => actor);
    app.decorate('db', {
      query: async () => {
        queryCount += 1;
        return { rows: [] };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminWebCatalogRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/catalog/skus',
      payload: {
        sku_code: '',
        sku_unit_id: 'not-an-id',
        current_sku_tariff_uzs: '-10',
        is_active: true,
        reason: 'x'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'bad_request',
        message: 'Проверьте заполнение обязательных полей'
      }
    });
    expect(queryCount).toBe(0);
  });

  it('omits technical code and display order so PostgreSQL generates both', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = Fastify({ logger: false });
    app.decorate('requireAdminActor', async () => actor);
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        calls.push({ sql, params });
        return { rows: [{ result: {
          activity_type_id: '18',
          activity_class: 'BREAK',
          technical_code: 'obed',
          display_order: 30
        } }] };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminWebCatalogRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/catalog/activity-types',
      payload: {
        activity_class: 'BREAK',
        display_name: 'Обед',
        profile_id: '1',
        reason: 'Добавление нового перерыва'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      sql: 'select app.create_admin_activity_type($1, $2, $3, $4, $5, $6, $7) as result',
      params: [
        'a'.repeat(64),
        'BREAK',
        null,
        'Обед',
        null,
        '1',
        'Добавление нового перерыва'
      ]
    }]);
  });

  it('moves an activity only through the approved atomic runtime function', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = Fastify({ logger: false });
    app.decorate('requireAdminActor', async () => actor);
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        calls.push({ sql, params });
        return { rows: [{ result: {
          activity_type_id: '18',
          activity_class: 'BREAK',
          moved: true
        } }] };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminWebCatalogRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/catalog/activity-types/move',
      payload: {
        activity_class: 'BREAK',
        activity_type_id: '18',
        direction: 'DOWN'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      sql: 'select app.move_admin_activity_type($1, $2, $3, $4) as result',
      params: ['a'.repeat(64), 'BREAK', '18', 'DOWN']
    }]);
  });

  it('returns a printable QR SVG without disclosing the protected payload as text', async () => {
    const protectedPayload = `peaks-sku:v1:${'S'.repeat(32)}`;
    const app = Fastify({ logger: false });
    app.decorate('requireAdminActor', async () => actor);
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        expect(sql).toContain('prepare_admin_qr_label(');
        expect(params).toEqual(['a'.repeat(64), 'SKU', '162']);
        return { rows: [{ result: {
          resource_kind: 'SKU',
          resource_id: '162',
          title: 'SKU-162',
          subtitle: 'Тестовая позиция',
          payload: protectedPayload
        } }] };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminWebCatalogRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/catalog/qr-label',
      payload: { resource_kind: 'SKU', resource_id: '162' }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/svg+xml');
    expect(response.headers['content-disposition']).toBe('attachment; filename="sku-162-qr.svg"');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toContain('SKU-162');
    expect(response.body).toContain('Сканируйте в приложении');
    expect(response.body).not.toContain(protectedPayload);
  });
});
