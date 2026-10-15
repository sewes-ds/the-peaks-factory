# Rollback — 20260830_002 activity type ordering

The default rollback is application-only:

1. activate the exact previous immutable application release;
2. run its health, admin-session, catalog-read, and Mini App canaries;
3. leave the additive `move_admin_activity_type` function installed.

The previous backend continues to call the unchanged seven-argument
`create_admin_activity_type(text,text,text,text,integer,bigint,text)` signature with explicit code and order,
so no database restore is required for application rollback.

The class-scoped downtime-name uniqueness constraint is also compatible with the previous application. It
relaxes only cross-class naming and preserves uniqueness inside each class.

Dropping the additive function or restoring the previous function body is destructive reverse DDL and is not
part of normal rollback. It requires a separately reviewed migration, a fresh restore-verified backup, stopped
new application traffic, and confirmation that no active release calls `move_admin_activity_type` or relies on
automatic code generation.
