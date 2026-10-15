# nginx

The `/peaks/` static aliases resolve through
`/srv/the-peaks-factory/current/frontend`. API proxying stays on the reviewed backend listener. The
configuration must not expose manifests, environment files, checksums, backups, staging paths, or
deployment receipts. Activation uses the atomic `current` pointer; nginx changes require a syntax check,
configuration backup, canary, rollback command, and production approval.

The administrative target keeps the Mini App mapping unchanged and adds:

- /admin/ from /srv/the-peaks-factory/current/frontend/admin/;
- /admin-api/ proxied without path rewriting to the same loopback backend;
- /admin redirected to /admin/;
- no-store HTML, same-origin-only API use, frame denial, and a restrictive static Content Security Policy.

`peaks-site.conf.template` is the source-only, Peaks-specific target for a dedicated domain. Render it with
`scripts/deploy/render-peaks-nginx.mjs`: the renderer derives `DOMAIN` from the same validated
`PUBLIC_BASE_URL` used by backend, rejects unsafe values, uses a literal domain for redirects/proxy Host,
and refuses to overwrite an existing output file. TLS paths and deployment root are deployment inputs;
no client hostname or credential belongs in Git.

Example using reserved documentation values:

```bash
node scripts/deploy/render-peaks-nginx.mjs \
  --public-base-url https://factory.example/peaks/ \
  --tls-certificate /etc/letsencrypt/live/factory.example/fullchain.pem \
  --tls-certificate-key /etc/letsencrypt/live/factory.example/privkey.pem \
  --deployment-root /srv/the-peaks-factory \
  --output /protected/stage/peaks-site.conf
```

The rendered file is staging input, not authorization to activate it. Before installation or reload:

1. compare its derived domain with the protected `PUBLIC_BASE_URL` without printing secrets;
2. capture the existing nginx configuration and exact rollback command;
3. run `nginx -t` against the staged complete configuration;
4. obtain production authorization;
5. install atomically, reload, run Host/TLS/static/API/auth canaries and inspect logs.

`peaks-admin.locations.example.conf` is a minimal location example for integration into an existing site.
Do not combine it blindly with the dedicated template.
