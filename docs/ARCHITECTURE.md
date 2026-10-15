# Architecture

## System context

```text
Operators and managers --> Telegram Bot / Mini App --+
                                                       +--> Fastify API --> PostgreSQL 16
Administrators ---------> Web application `/admin/` --+                    business authority
                                                                      |
                                                                      +--> notifications / exports
```

Telegram proves transport identity but does not own production permissions. Employee status, roles,
authorization, state transitions, audit, salary rules, and concurrency constraints are application data
owned by PostgreSQL.

## Components

| Component | Technology | Responsibility |
|---|---|---|
| Mini App | React, Vite, TypeScript | Graph navigation and exact presentation of backend state |
| Administration Web | React, Vite, TypeScript | Desktop-first authenticated catalog and system administration |
| API / Bot | Fastify, TypeScript | Validation, authentication, actor resolution, database calls, provider integration |
| Database | PostgreSQL 16 | Business state, mutation authorization, transitions, locks, audit, salary and notification rules |
| Runtime | nginx, systemd, immutable release directories | TLS, static assets, API proxying, process lifecycle, atomic activation and rollback |

## Request boundary

```text
Telegram initData / browser session / worker proof
  -> route-schema validation
  -> authenticated employee actor or bounded worker identity
  -> approved read model or allowlisted `runtime_api` function
  -> PostgreSQL validation, locking, mutation and audit
  -> typed API response
  -> frontend graph/presentation projection
```

Normal backend runtime uses only `app_runtime_role`. It must not use a superuser, migration credential,
administrative database URL, direct domain-table DML, `internal_helper`, or `maintenance_api`.

## Database authority

The clean database baseline is applied in this order:

1. `db/schema/schema.sql`
2. `db/seed/seed.sql`
3. `db/functions/functions.sql`
4. `db/grants/grants.sql`
5. `db/verify/verify_schema.sql`

Released incremental packages live under `db/migrations/`. Each package is fail-closed, runs with separate
migration authority, and defines preflight, apply, verification, idempotency, and rollback boundaries.
Protected input and production data never belong in Git.

## Frontend model

The Mini App uses canonical graph nodes. Backend state changes node data, action availability, and semantic
presentation; it does not create alternate screens implicitly. Navigation follows declared transitions and
actual route history.

The administration web is intentionally separate from the Telegram graph. Password and Telegram QR are
identity providers for the same server-side browser-session model. Session tokens, CSRF tokens, password
material, and raw QR challenges are never logged or stored in source.

## Public URL and same-origin security

Production requires one canonical `PUBLIC_BASE_URL` with the fixed `/peaks/` path. The backend derives the
trusted origin and host from this value and never trusts forwarding headers to create public URLs. Both
frontends use root-relative application paths. Administrative mutations require exact Origin, an active
session, and a matching CSRF proof.

## Release model

Application releases are immutable and assembled from one exact verified commit. Runtime secrets, logs,
uploads, databases, backups, and receipts remain outside the release tree.

```text
verified source -> immutable release directory
                         ^
                 current / previous
```

Activation changes the atomic `current` pointer and the controlled service state. Rollback selects a whole
compatible release; it never mixes component directories from different versions.
