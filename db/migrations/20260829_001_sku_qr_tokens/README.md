# 20260829_001 — SKU QR tokens

- Status: `RELEASED`

This additive package assigns one unique opaque QR token to each existing SKU and installs the audited
runtime rotation contract. SKU identity, catalog attributes, tariff values, and operational history are not
changed.

Raw tokens exist only in protected input and generated label artifacts. They must not enter Git, release
directories, URLs, logs, screenshots, receipts, or command output.

The package accepts only a compatible pre-migration state (`APPLY`) or an exact already-applied state
(`NOOP`). Partial and divergent states fail before DML. Production execution requires migration authority,
stopped traffic, a fresh restore-verified backup, exact source/release identity, and a protected receipt.
See `rollback.md` for the restore boundary.

```bash
node --test scripts/package-tools.test.mjs
node --test scripts/production-tools.test.mjs
```
