import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import { parseAdminCatalogPart } from '../../src/routes/adminCatalog.js';
import { callAdminCatalogRuntime } from '../../src/services/adminCatalog.js';

const actor: ActorContext = {
  employeeId: 7n,
  telegramUserId: 1000n
};

function createPool(expectedSql: string, expectedParams: readonly unknown[]): DbPool {
  return {
    query: async (sql: string, params: readonly unknown[]) => {
      expect(sql).toBe(expectedSql);
      expect(params).toEqual(expectedParams);
      return { rows: [{ result: '42' }] };
    }
  } as unknown as DbPool;
}

describe('admin catalog service', () => {
  it('creates employee through approved runtime_api with explicit actor', async () => {
    await expect(
      callAdminCatalogRuntime(
        createPool('select app.create_employee($1, $2, $3, $4, $5, $6) as result', ['7', 'Name', '+998901234567', '1', null, '2']),
        actor,
        'create_employee',
        ['Name', '+998901234567', '1', null, '2']
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('rotates machine QR through approved runtime_api with explicit actor', async () => {
    await expect(
      callAdminCatalogRuntime(
        createPool('select app.rotate_machine_qr_token($1, $2, $3, $4) as result', ['7', '10', 'token', 'reason']),
        actor,
        'rotate_machine_qr_token',
        ['10', 'token', 'reason']
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('rotates SKU QR through approved runtime_api with explicit actor', async () => {
    await expect(
      callAdminCatalogRuntime(
        createPool('select app.rotate_sku_qr_token($1, $2, $3, $4) as result', ['7', '44', 'token', 'reason']),
        actor,
        'rotate_sku_qr_token',
        ['44', 'token', 'reason']
      )
    ).resolves.toEqual({ id: '42' });
  });
});

describe('admin catalog route validation', () => {
  it('maps invalid request parts to API bad request', () => {
    expect(() => parseAdminCatalogPart(z.object({ id: z.string().regex(/^[1-9][0-9]*$/) }), { id: '0' })).toThrow(
      'Invalid admin catalog request'
    );
  });
});
