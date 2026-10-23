# systemd

The sanitized reference backend unit is `peaks-backend.service`.

The backend unit must:

- use `/srv/the-peaks-factory/current/backend` as its runtime boundary;
- execute Node.js from the versioned, checksum-verified
  `/srv/the-peaks-factory/toolchains/node-v24.22.1-linux-x64/bin/node` path;
- execute only files contained in the validated release;
- read its protected environment from `/etc/the-peaks-factory/`;
- write no logs, state, cache, or generated output into the release directory;
- fail if `current` is absent, non-canonical, or does not resolve below the accepted releases root.

The protected environment is not stored in Git. Installing or changing a unit remains a separate
production-gated operation; this source copy is not an activation command.

Keep the previous unit and runtime binary until the Node 24 release has passed restart and public
canaries. A complete rollback restores the previous unit, reloads systemd, switches the immutable
release pointer back through the release tooling, and then verifies the same canaries.
