# Versioned releases

- Status: `CURRENT_CONTRACT`
- Architecture: [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
- Operations: [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)

This directory contains source-controlled release contracts and examples only. Built releases, runtime
environment files, deployment receipts, backups, QR staging, and rollback artifacts never belong here.

Validate the structural example:

```bash
node scripts/verify-release-contract.mjs --allow-example \
  deploy/releases/release-manifest.example.json
```

Validate a real staged manifest without `--allow-example` before installation:

```bash
node scripts/verify-release-contract.mjs /protected/stage/release-manifest.json
```

Assembler, package verification, install, guarded pointer activation, receipt, canary, rollback, and
isolated rehearsal tools live under `../../scripts/releases/`.
