# systemd

The sanitized reference backend unit is `peaks-backend.service`.

The backend unit must:

- use `/srv/the-peaks-factory/current/backend` as its runtime boundary;
- execute only files contained in the validated release;
- read its protected environment from `/etc/the-peaks-factory/`;
- write no logs, state, cache, or generated output into the release directory;
- fail if `current` is absent, non-canonical, or does not resolve below the accepted releases root.

The protected environment is not stored in Git. Installing or changing a unit remains a separate
production-gated operation; this source copy is not an activation command.
