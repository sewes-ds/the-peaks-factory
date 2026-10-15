# The Peaks Factory

Production accounting system for a factory: Telegram Mini App for operators and managers, a separate
administration web application, a Fastify API, and a PostgreSQL business core.

> **Source available — not open source.** The repository is published for transparency and technical
> review. The code may not be used, deployed, modified, or redistributed except for the limited rights
> stated in [LICENSE](LICENSE) and the rights granted directly by GitHub's terms.

## What is included

- operator workflows for shifts, production, downtime, breaks, additional work, and salary views;
- manager workflows for machines, employees, incidents, notifications, and reporting boundaries;
- Telegram authentication and protected machine/SKU QR selection;
- an administration web application with password and Telegram QR authentication providers;
- catalog management for employees, positions, machines, SKU, activity types, and QR labels;
- PostgreSQL-owned state transitions, authorization, audit, locking, and salary rules;
- immutable-release, nginx, systemd, migration, and verification tooling;
- the automated tests used to verify the published production baseline.

The snapshot is intentionally limited to the current implementation. Internal work packages, agent logs,
recovery material, unsuccessful experiments, private operational evidence, secrets, and the original Git
history are not part of this repository.

## Architecture

```text
Telegram Bot / Mini App ----+
                            +--> Fastify API --> PostgreSQL 16
Administration Web --------+                    business state and rules
```

The backend is a thin integration layer. It validates transport input, resolves an employee actor, and
calls approved PostgreSQL functions or read models. Business transitions and mutation authorization remain
in PostgreSQL. Both web applications use stable root-relative paths; the public host is supplied at runtime
through `PUBLIC_BASE_URL`.

See [Architecture](docs/ARCHITECTURE.md) for the complete boundary description.

## Technology

- Node.js 20.20 or newer;
- pnpm 10;
- TypeScript;
- Fastify 5;
- React 19 and Vite 8;
- PostgreSQL 16;
- Vitest and Playwright Core;
- nginx and systemd for the reference VDS deployment.

## Verification

Install and verify each application independently:

```bash
cd backend
pnpm install --frozen-lockfile
pnpm run verify

cd ../frontend/miniapp
pnpm install --frozen-lockfile
pnpm run test
pnpm run typecheck
pnpm run build

cd ../admin
pnpm install --frozen-lockfile
pnpm run verify
```

Repository and database verification commands are documented in [Testing](docs/TESTING.md). Production
configuration and deployment boundaries are documented in [Deployment](docs/DEPLOYMENT.md).

## Documentation

- [Project status](docs/PROJECT_STATUS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Contributions and security

This is a review-only publication; unsolicited contributions are not accepted. See
[CONTRIBUTING.md](CONTRIBUTING.md). Do not report vulnerabilities in a public issue; use the private
reporting process in [SECURITY.md](SECURITY.md).
