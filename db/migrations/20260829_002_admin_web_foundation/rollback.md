# Rollback — 20260829_002 admin web foundation

## Default rollback

The database change is additive. The previous immutable application release does not use
can_access_admin_panel, admin_password_credentials, admin_sessions, or the seventeen new runtime functions.
Rollback therefore defaults to:

1. keep database state;
2. atomically reactivate the exact previous application release;
3. prove the Telegram Mini App health/auth canary;
4. retain migration and rollback evidence.

Before any credential is provisioned, the new password entry path has no usable identity.

## When database reversal is required

Do not improvise reverse DDL. Restore the verified fresh pre-migration backup while traffic remains closed
if the migration itself must be removed before activation. Once credentials or sessions exist, dropping
the tables destroys authentication history and is not an accepted rollback.

## Rehearsal requirements

- first-run APPLY succeeds from the exact source baseline;
- immediate repeat-run reports NOOP without writes;
- one deliberately partial state fails in preflight;
- canonical target baseline and migrated source produce the same schema/function/grant contract;
- previous application release remains healthy against the additive target.
