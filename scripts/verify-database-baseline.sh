#!/usr/bin/env bash

set -euo pipefail

if [[ "${PEAKS_ALLOW_EPHEMERAL_DATABASE_VERIFY:-}" != "1" ]]; then
  echo "DATABASE_BASELINE_VERIFY_REFUSED: set PEAKS_ALLOW_EPHEMERAL_DATABASE_VERIFY=1 for an isolated disposable database" >&2
  exit 2
fi

if [[ -z "${PEAKS_DB_ADMIN_URL:-}" ]]; then
  echo "DATABASE_BASELINE_VERIFY_REFUSED: PEAKS_DB_ADMIN_URL is required" >&2
  exit 2
fi

peaks_repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
peaks_verify_output="$(mktemp)"
trap 'rm -f "${peaks_verify_output}"' EXIT

peaks_existing_application_objects="$({
  psql "${PEAKS_DB_ADMIN_URL}" -X -q -A -t -v ON_ERROR_STOP=1 -c \
    "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'app';"
} 2>/dev/null)"

if [[ "${peaks_existing_application_objects}" != "0" ]]; then
  echo "DATABASE_BASELINE_VERIFY_REFUSED: target already contains application objects" >&2
  exit 2
fi

psql "${PEAKS_DB_ADMIN_URL}" -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_owner_role') then
    create role app_owner_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'migration_role') then
    create role migration_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_runtime_role') then
    create role app_runtime_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'readonly_role') then
    create role readonly_role nologin;
  end if;
end;
$$;
SQL

psql "${PEAKS_DB_ADMIN_URL}" -X -q -v ON_ERROR_STOP=1 -f "${peaks_repository_root}/db/schema/schema.sql"
psql "${PEAKS_DB_ADMIN_URL}" -X -q -v ON_ERROR_STOP=1 -f "${peaks_repository_root}/db/seed/seed.sql"
psql "${PEAKS_DB_ADMIN_URL}" -X -q -v ON_ERROR_STOP=1 -f "${peaks_repository_root}/db/functions/functions.sql"
psql "${PEAKS_DB_ADMIN_URL}" -X -q -v ON_ERROR_STOP=1 -f "${peaks_repository_root}/db/grants/grants.sql"
psql "${PEAKS_DB_ADMIN_URL}" -X -v ON_ERROR_STOP=1 -A -t -F '|' \
  -f "${peaks_repository_root}/db/verify/verify_schema.sql" | tee "${peaks_verify_output}"

if awk -F '|' '$3 == "FAIL" { found = 1 } END { exit found ? 0 : 1 }' "${peaks_verify_output}"; then
  echo "DATABASE_BASELINE_VERIFY_FAIL: verify_schema.sql returned a blocking FAIL" >&2
  exit 1
fi

if ! grep -q '|PASS|' "${peaks_verify_output}"; then
  echo "DATABASE_BASELINE_VERIFY_FAIL: verify_schema.sql emitted no PASS checks" >&2
  exit 1
fi

echo "DATABASE_BASELINE_VERIFY_PASS"
