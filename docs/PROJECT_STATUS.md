# Project status

## Published baseline

This repository is a clean source snapshot of the version running in production at the time of publication.
The internal provenance, deployment receipts, backups, incident material, and complete development history
remain private. The public repository starts with a new baseline commit so that removed internal material
cannot be recovered from Git history.

The last pre-publication verification was performed on 15 October 2026 against the production source
baseline. It covered 1,349 automated application and tooling tests, the PostgreSQL baseline contract,
desktop/mobile browser checks, immutable release verification, and public HTTP health/authentication canaries.

## Implemented and active

- Telegram authentication and employee access outcomes;
- operator shift, machine, production, downtime, break, additional-work, and salary flows;
- production-manager machine, employee, downtime, salary/correction, notification, and report routes;
- protected machine and SKU QR selection;
- administration web application with common browser sessions, Telegram QR login, password-provider
  foundation, overview, actor-aware directories, catalog editing, QR labels, and audit views;
- PostgreSQL notification generation, routing, persistence, and provider delivery worker;
- activity-type behavior profiles, automatic codes, and class-local ordering;
- domain-portable runtime configuration and immutable release deployment.

## Explicitly outside the current product scope

- a complete Director cabinet (the access boundary and placeholder exist);
- end-user Google Sheets delivery;
- corrections for previous shifts and a payroll-payment-period model;
- a generally issued production password credential set (the provider foundation exists, while Telegram QR
  is the normal administration login path).

These gaps are documented to prevent the published snapshot from being mistaken for functionality it does
not provide.

## Publication boundary

The following material is deliberately excluded:

- agent/work-package logs and generated evidence;
- abandoned implementations and archived design explorations;
- repository recovery branches, bundles, dirty-worktree snapshots, and historical pull-request branches;
- production domains, protected environment files, credentials, database dumps, personal data, raw QR
  values, logs, screenshots, and deployment receipts;
- customer-specific infrastructure configuration.

Compatibility modules that are imported by the current production build remain in source. Removing them
would change the executable artifact and therefore requires a separately tested application release.
