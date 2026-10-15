# Scripts

Repository-level development and maintenance helpers. A script that mutates data or production state
must declare its target, preconditions, dry-run/rehearsal behavior, verification, and rollback boundary.

Current non-production verification helpers:

- `verify-documentation.mjs` — required document markers, current-status contradictions, and relative
  Markdown links;
- `verify-repository-hygiene.mjs` — tracked secret, internal-path, generated-artifact, and publication
  boundary checks;
- `verify-database-baseline.sh` — builds and verifies the canonical SQL package only against an explicitly
  authorized disposable PostgreSQL database.

Immutable release lifecycle tools live under `releases/`. They assemble and verify combined application
packages, install never-before-used release IDs, guard atomic relative-pointer changes, validate
deployment receipts, run credential-free read-only HTTP canaries, and exercise complete rollback in an
isolated root. See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md); none of these tools mutates PostgreSQL.
