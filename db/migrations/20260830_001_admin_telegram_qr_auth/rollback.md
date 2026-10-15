# Rollback — 20260830_001 admin Telegram QR authentication

## Normal application rollback

Reactivate the exact previous immutable release. The previous backend never calls the new functions and ignores
the private table. Existing password sessions remain valid according to their original lifecycle; pending QR
challenges cannot be confirmed or claimed while the previous release is active. Database restore is not required.

## Before accepted traffic only

If the migration contract itself fails before the new release serves traffic, keep the previous release active and
restore the verified pre-migration backup using the protected release procedure.

## Destructive reverse DDL

Dropping the three functions and `app.admin_telegram_qr_challenges` destroys authentication evidence and is not a
normal rollback. It requires a separate incident decision after proving no accepted QR-auth traffic or retention
requirement depends on those rows.
