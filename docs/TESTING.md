# Testing

## Verified baseline

The last pre-publication run on 15 October 2026 produced these results:

| Area | Result |
|---|---:|
| Backend Vitest | 345 passed |
| Mini App Vitest | 972 passed |
| Administration Web Vitest | 2 passed |
| Repository, release, migration, and deployment tool tests | 30 passed |
| Total automated test cases | 1,349 passed |
| PostgreSQL baseline contract | 45 checks passed |
| Administration browser gate | Desktop and mobile passed |
| Domain portability rehearsal | Two domains, one unchanged build passed |
| Production read-only canaries | Health/static endpoints passed; unauthenticated APIs denied |

Counts describe the verified publication baseline and may change as tests are added or consolidated.

## Node 24.22.1 source qualification (23 October 2026)

In an isolated checkout of the public `main` baseline, Node 24.22.1 with pnpm 10.33.0 passed
frozen-lockfile installs, 345 backend tests, 972 Mini App tests, 2 administration tests,
30 repository/release/tool tests, all three application builds and type checks, both
domain-portability checks, and the administration browser gate at desktop and mobile widths.
The PostgreSQL baseline and an actual immutable release/runtime restart were not rerun in this
qualification. CI on the proposed Node 24 commit and a reviewed production activation remain
separate requirements; source-level success does not update a running service.

## Local gates

Backend contract, security scan, type checking, unit tests, and production build:

```bash
cd backend
pnpm install --frozen-lockfile
pnpm run verify
```

Mini App:

```bash
cd frontend/miniapp
pnpm install --frozen-lockfile
pnpm run test
pnpm run typecheck
pnpm run build
```

Administration Web:

```bash
cd frontend/admin
pnpm install --frozen-lockfile
pnpm run verify
pnpm run test:browser
```

Repository tooling:

```bash
node scripts/verify-documentation.mjs
node scripts/verify-repository-hygiene.mjs
node scripts/verify-release-contract.mjs --allow-example \
  deploy/releases/release-manifest.example.json
node --test scripts/verify-release-contract.test.mjs
node --test scripts/releases/release-tools.test.mjs
node --test scripts/deploy/render-peaks-nginx.test.mjs
node --test scripts/deploy/telegram-domain-tools.test.mjs
node --test db/migrations/20260828_001_machine_sku_qr_catalog/scripts/migration-tools.test.mjs
node --test db/migrations/20260829_001_sku_qr_tokens/scripts/package-tools.test.mjs
node --test db/migrations/20260829_001_sku_qr_tokens/scripts/production-tools.test.mjs
```

Disposable PostgreSQL 16 baseline verification:

```bash
PEAKS_ALLOW_EPHEMERAL_DATABASE_VERIFY=1 \
PEAKS_DB_ADMIN_URL=postgresql://postgres@127.0.0.1:5432/peaks_verify \
scripts/verify-database-baseline.sh
```

Never point verification scripts at a production database.

## Continuous integration

GitHub Actions runs four primary jobs: repository hygiene/tooling, PostgreSQL baseline, backend, and
frontend. Pull requests also receive dependency review. Successful CI is necessary but not sufficient for
a production deployment; immutable packaging, backup, canary, and rollback gates remain separate.
