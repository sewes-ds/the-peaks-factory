# 20260829_002 — Administration web authentication foundation

- Status: `RELEASED`

This additive package installs provider-neutral browser sessions, the password-provider foundation,
actor-aware administration reads, and guarded catalog mutation functions. It creates no employee login or
real password.

Password hashes and session metadata are restricted authentication data. Raw passwords, session tokens,
and CSRF tokens are not migration input and must never enter Git, logs, receipts, or command arguments.
The runtime role receives only allowlisted function execution and no direct access to private credential or
session tables.

Run `preflight.sql`, `apply.sql`, and `verify.sql` in one `psql` process with migration authority. Only the
complete compatible source state (`APPLY`) or complete target state (`NOOP`) is accepted. The previous
application remains compatible with the additive objects; destructive reverse DDL is not the default
rollback path. See `rollback.md`.
