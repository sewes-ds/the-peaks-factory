# Environment Templates

Reserved location for sanitized deployment environment templates. Real runtime environment files remain
outside every Git worktree and immutable release, under the protected `/etc/the-peaks-factory/` boundary
described in [`../../../docs/DEPLOYMENT.md`](../../../docs/DEPLOYMENT.md). No real secret, token, password,
QR value, database URL, or production credential may be committed here or recorded in a release manifest.
