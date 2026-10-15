# Deployment

This document describes the reference boundary, not a production authorization or a turnkey copy/paste
procedure. Every operator must supply their own domain, credentials, backup policy, access controls, and
reviewed release approval.

## Runtime requirements

- Linux host with Node.js 20.20+, pnpm 10, PostgreSQL 16, nginx, and systemd;
- a dedicated PostgreSQL runtime role and separate migration/admin authority;
- TLS for one configured public host;
- a protected environment file outside Git and outside release directories;
- verified backup and restore capability before a database change.

## Configuration

Start from `.env.example`. At minimum, production supplies:

- `APP_ENV=production`;
- `DATABASE_URL` for `app_runtime_role`;
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`;
- Telegram webhook and self-binding secrets;
- `INTERNAL_WORKER_TOKEN`;
- `PUBLIC_BASE_URL=https://<public-fqdn>/peaks/`;
- the Google service-account path if export integration is enabled.

Never store a real environment file, token, password, database URL, QR value, or service-account document
in Git or in an immutable release.

## Database bootstrap

Apply the baseline in the exact order documented in [Architecture](ARCHITECTURE.md#database-authority),
using administrative credentials only for the bootstrap. Confirm that `verify_schema.sql` reports no
failure before starting the backend. Released migrations are for an existing compatible database; do not
apply them blindly to a fresh baseline.

## Application build

```bash
cd backend && pnpm install --frozen-lockfile && pnpm run build
cd ../frontend/miniapp && pnpm install --frozen-lockfile && pnpm run build
cd ../admin && pnpm install --frozen-lockfile && pnpm run build
```

The release tooling under `scripts/releases/` validates manifests, packages a complete application version,
checks hashes, installs a never-before-used release ID, and controls atomic activation/rollback. Built
artifacts, receipts, and backups are intentionally excluded from this repository.

## nginx and systemd

`deploy/vds/nginx/peaks-site.conf.template` is rendered with a domain derived from the same
`PUBLIC_BASE_URL` used by the backend. Validate the complete nginx configuration before reload. The systemd
example runs the backend from the `current` immutable release pointer and reads protected configuration
from `/etc/the-peaks-factory/`.

## Release gate

Before production activation:

1. verify a clean, reviewed commit and green CI;
2. assemble and verify one immutable release;
3. prove database compatibility and restore a fresh backup in isolation when data changes;
4. stage and syntax-check nginx/systemd changes;
5. record the exact previous compatible release;
6. activate atomically and run health, static asset, database-role, authentication-denial, TLS, and log
   canaries;
7. roll back the entire release if any blocking canary fails.

Changing the public domain also changes the trusted Host/Origin and requires coordinated TLS, DNS, nginx,
Telegram menu/webhook, runtime environment, canary, and rollback updates.
