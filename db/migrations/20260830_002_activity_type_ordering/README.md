# 20260830_002 — Activity type automatic codes and ordering

- Status: `RELEASED`

This package moves technical-code generation and activity ordering into PostgreSQL. New activity types are
appended within their class, and audited move operations reorder active entries atomically. Downtime display
names are unique within a class rather than globally.

The existing create-function signature remains compatible. Applying the package does not create, delete, or
reorder catalog rows; it changes the constraint and function contracts only.

Run `preflight.sql`, `apply.sql`, and `verify.sql` in one `psql` process with migration authority. Complete
source and target states map to `APPLY` and `NOOP`; partial or divergent function state fails closed. See
`rollback.md` for application compatibility and reversal constraints.
