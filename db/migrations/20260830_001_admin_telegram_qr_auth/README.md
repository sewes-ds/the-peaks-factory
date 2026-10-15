# 20260830_001 — Administration Telegram QR authentication

- Status: `RELEASED`

This additive package installs the private, browser-bound Telegram QR challenge lifecycle and its three
allowlisted runtime functions. It creates no challenge, session, password credential, Telegram binding,
employee, role, or catalog row.

Browser and Telegram proofs are independent opaque values; PostgreSQL stores only their SHA-256 hashes.
Confirmation succeeds only for an existing Telegram identity bound to an active employee with an active
administration role.

Run `preflight.sql`, `apply.sql`, and `verify.sql` in one `psql` process with migration authority. A complete
source state becomes `APPLY`, a complete target becomes `NOOP`, and any partial state fails. The previous
application ignores the additive table and functions; destructive reverse DDL is not the default rollback
path. See `rollback.md`.
