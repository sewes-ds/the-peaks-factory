import { describe, expect, it } from 'vitest';
import { createAdminOpaqueToken, hashAdminOpaqueToken } from '../../src/auth/adminPassword.js';
import { adminSessionPlugin } from '../../src/plugins/adminSession.js';
import type { DbPool } from '../../src/db/pool.js';

async function createRequireAdminActor(sessionToken: string, csrfToken: string) {
  const decorators = new Map<string, unknown>();
  const app = {
    db: {
      query: async (sql: string, params: readonly unknown[]) => {
        expect(sql).toBe('select app.resolve_admin_session($1) as result');
        expect(params).toEqual([hashAdminOpaqueToken(sessionToken)]);
        return {
          rows: [{
            result: {
              session_id: '11',
              employee_id: '7',
              full_name: 'Иванов И.И.',
              role_name: 'Директор',
              auth_method: 'PASSWORD',
              must_change_password: false,
              csrf_token_hash: hashAdminOpaqueToken(csrfToken),
              created_at: '2026-08-29T12:00:00.000Z',
              last_seen_at: '2026-08-29T12:01:00.000Z',
              idle_expires_at: '2026-08-29T12:31:00.000Z',
              expires_at: '2026-08-29T20:00:00.000Z'
            }
          }]
        };
      }
    } as unknown as DbPool,
    decorate: (name: string, value: unknown) => {
      decorators.set(name, value);
      (app as Record<string, unknown>)[name] = value;
    }
  };

  await adminSessionPlugin(app as never, {});
  return decorators.get('requireAdminActor') as (
    request: {
      headers: Record<string, string>;
      adminActor?: unknown;
    },
    options?: { mutation?: boolean }
  ) => Promise<unknown>;
}

describe('admin session plugin', () => {
  it('resolves a paired session and CSRF cookie into an attributable actor', async () => {
    const sessionToken = createAdminOpaqueToken();
    const csrfToken = createAdminOpaqueToken();
    const requireAdminActor = await createRequireAdminActor(sessionToken, csrfToken);

    await expect(requireAdminActor({
      headers: {
        cookie: 'peaks_admin_session=' + sessionToken + '; peaks_admin_csrf=' + csrfToken
      }
    })).resolves.toMatchObject({
      employee_id: '7',
      role_name: 'Директор',
      sessionTokenHash: hashAdminOpaqueToken(sessionToken)
    });
  });

  it('rejects a state-changing request without the matching CSRF header', async () => {
    const sessionToken = createAdminOpaqueToken();
    const csrfToken = createAdminOpaqueToken();
    const requireAdminActor = await createRequireAdminActor(sessionToken, csrfToken);

    await expect(requireAdminActor({
      headers: {
        cookie: 'peaks_admin_session=' + sessionToken + '; peaks_admin_csrf=' + csrfToken
      }
    }, { mutation: true })).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden'
    });
  });

  it('rejects a session paired with the wrong CSRF cookie', async () => {
    const sessionToken = createAdminOpaqueToken();
    const csrfToken = createAdminOpaqueToken();
    const requireAdminActor = await createRequireAdminActor(sessionToken, csrfToken);

    await expect(requireAdminActor({
      headers: {
        cookie: 'peaks_admin_session=' + sessionToken + '; peaks_admin_csrf=' + createAdminOpaqueToken()
      }
    })).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated'
    });
  });
});
