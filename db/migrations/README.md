# Migrations

This directory contains released, immutable data and schema migration packages for compatible existing
databases. A fresh installation uses the canonical baseline instead.

Directory name:

```text
<YYYYMMDD>_<sequence>_<short_snake_case_slug>
```

Required package contract:

- `README.md` — outcome, source/target, scope, data/security impact, decisions, exact run order;
- preflight — fail before DML on baseline, privilege, input, dictionary, and target-state mismatch;
- apply — explicit transaction/lock/idempotency semantics;
- verify — blocking deterministic postconditions that do not disclose protected values;
- rollback — restore/reverse boundary, rehearsal, and point of no return;
- local verification — first-run, repeat-run, failure, and restore checks tied to exact source.

Released migration directories are immutable. Fixes use a new ID. Raw data files, dumps, QR values,
credentials, execution receipts, and rollback bundles never belong in this directory. Source code alone
does not authorize a production migration.
