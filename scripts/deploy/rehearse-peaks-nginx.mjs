#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderPeaksNginx } from './render-peaks-nginx.mjs';

const rehearsalRoot = mkdtempSync(join(tmpdir(), 'peaks-nginx-rehearsal-'));
const httpPort = 18000 + (process.pid % 1000) * 2;
const httpsPort = httpPort + 1;
const productionTemplate = readFileSync(
  new URL('../../deploy/vds/nginx/peaks-site.conf.template', import.meta.url),
  'utf8'
);
const unprivilegedTemplate = productionTemplate
  .replaceAll('listen [::]:80', `listen [::]:${httpPort}`)
  .replaceAll('listen 80', `listen ${httpPort}`)
  .replaceAll('listen [::]:443', `listen [::]:${httpsPort}`)
  .replaceAll('listen 443', `listen ${httpsPort}`);

try {
  const certificate = join(rehearsalRoot, 'certificate.pem');
  const certificateKey = join(rehearsalRoot, 'certificate-key.pem');
  run('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=factory.example',
    '-keyout', certificateKey,
    '-out', certificate
  ]);

  for (const publicBaseUrl of [
    'https://factory.example/peaks/',
    'https://app.customer.example/peaks/'
  ]) {
    const sitePath = join(rehearsalRoot, 'peaks-site.conf');
    const rootConfigPath = join(rehearsalRoot, 'nginx.conf');
    const site = renderPeaksNginx({
      publicBaseUrl,
      tlsCertificate: certificate,
      tlsCertificateKey: certificateKey,
      deploymentRoot: '/srv/the-peaks-factory',
      template: unprivilegedTemplate
    });
    writeFileSync(sitePath, site, { encoding: 'utf8', mode: 0o600 });
    writeFileSync(rootConfigPath, [
      `pid ${join(rehearsalRoot, 'nginx.pid')};`,
      'error_log stderr notice;',
      'events {}',
      'http {',
      '  access_log off;',
      `  include ${sitePath};`,
      '}',
      ''
    ].join('\n'), { encoding: 'utf8', mode: 0o600 });
    run('nginx', ['-t', '-p', rehearsalRoot, '-c', rootConfigPath]);
  }

  process.stdout.write('PEAKS_NGINX_REHEARSAL_PASS domains=2\n');
} finally {
  rmSync(rehearsalRoot, { recursive: true, force: true });
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
}
