# Backend

Production Fastify backend for the Telegram Bot, Mini App API, scheduled jobs, PostgreSQL integration,
read models, notifications, and export boundaries.

The backend is intentionally a thin integration layer. Business transitions and mutation permissions remain
in approved PostgreSQL contracts. Normal runtime uses `app_runtime_role`; administrative and migration
credentials are outside the application boundary.

Production requires one explicit protected `PUBLIC_BASE_URL` such as
`https://factory.example/peaks/`. Backend derives the trusted public Origin and Host from it; nginx derives
its `DOMAIN` from the same value. There is no production domain default, and no customer hostname or
runtime credential belongs in Git or an immutable release.

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

The verification gate checks the runtime API map, the security boundary, types, tests, and the production
build. See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for component responsibilities.
