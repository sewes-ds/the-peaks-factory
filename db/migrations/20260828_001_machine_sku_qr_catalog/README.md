# 20260828_001 — Machine, SKU, and protected QR catalog

- Status: `RELEASED`
- Target: an empty machine/SKU catalog on the compatible pre-migration schema

This package imports a protected machine and SKU catalog without operational history. Machine QR values are
generated in owner-only staging and never enter Git, terminal output, logs, screenshots, or receipts.

## Execution contract

1. restore and verify the authorized source backup in isolation;
2. generate a new protected input directory with `scripts/generate-protected-input.mjs`;
3. create and restore-verify a fresh target backup;
4. run `scripts/run-migration.mjs` with migration authority while application traffic is stopped;
5. run the canonical database verifier and the catalog read-model harness;
6. retain the backup, protected input, and execution receipt outside Git.

Only two target states are accepted: an empty catalog (`APPLY`) or an exact match to the protected package
(`NOOP`). Partial or divergent state fails before domain DML. Rollback uses the verified fresh backup; see
`rollback.md`.

Tool contract:

```bash
node --test scripts/migration-tools.test.mjs
```

The full isolated rehearsal additionally requires explicit `PEAKS_R3_SOURCE_DUMP` and
`PEAKS_R3_REHEARSAL_EVIDENCE_DIR` paths outside the repository.
