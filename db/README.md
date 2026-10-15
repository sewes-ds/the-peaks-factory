# Database Artifacts

This directory contains the canonical PostgreSQL baseline and released incremental migration packages.

Deployment artifact order:

1. `schema/schema.sql`
2. `seed/seed.sql`
3. `functions/functions.sql`
4. `grants/grants.sql`
5. `verify/verify_schema.sql`

Do not create executable SQL outside a reviewed, versioned SQL/migration package. Business-rule changes
must update executable artifacts, grants, verification, application contracts, and rollback as one
controlled change. Protected input and production data never belong in this directory.
