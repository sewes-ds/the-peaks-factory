# Rollback boundary

Production rollback is a complete restore from the fresh custom-format backup captured and validated
immediately before the migration. The backup SHA-256, `pg_restore --list` result, database identity,
exact release commit, and package digest must be in protected release evidence.

Reverse `DELETE` is not an accepted rollback because machines and SKU can acquire dependent production,
downtime, status-event, and salary rows once traffic opens. Production traffic therefore remains closed
until migration verification and the release canary are accepted. A failure before commit rolls back the
single migration transaction; a failure after commit but before acceptance restores the full backup.

The target restore must preserve the backup's owners and privileges. `--no-owner` and `--no-privileges`
are forbidden for rollback because they produce a structurally populated database with a broken runtime
security/grant contract. Those flags are used only when restoring the untrusted legacy source into an
isolated extraction database.

The isolated rehearsal must prove that restoring the pre-migration backup returns machine and SKU counts
to zero and that canonical schema verification passes. No production restore is authorized by this file.
