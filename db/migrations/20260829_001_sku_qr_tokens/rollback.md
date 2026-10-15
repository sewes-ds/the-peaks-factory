# Rollback boundary

The database change is additive and the previous application release ignores it. An application rollback
therefore keeps the migrated database and switches the immutable release symlink back.

If the migration or pre-traffic acceptance fails, keep traffic stopped and restore the complete fresh,
verified custom-format backup. Do not drop only the column or delete token values: that would leave the
canonical function/grant/schema contract partial and would not restore all database catalog metadata.

Once any traffic has used SKU QR, the full pre-migration restore is no longer an automatic rollback because
it can discard newer business transactions. That point requires a separate owner decision and recovery
plan. No production restore or reverse DDL is authorized by this package.
