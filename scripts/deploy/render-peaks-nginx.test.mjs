import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveDomain, renderPeaksNginx } from './render-peaks-nginx.mjs';

const common = {
  tlsCertificate: '/etc/letsencrypt/live/factory.example/fullchain.pem',
  tlsCertificateKey: '/etc/letsencrypt/live/factory.example/privkey.pem',
  deploymentRoot: '/srv/the-peaks-factory'
};

test('renders the same domain-neutral template for infrastructure and customer domains', () => {
  for (const [publicBaseUrl, domain] of [
    ['https://factory.example/peaks/', 'factory.example'],
    ['https://app.customer.example/peaks/', 'app.customer.example']
  ]) {
    const rendered = renderPeaksNginx({ ...common, publicBaseUrl });
    assert.match(rendered, new RegExp(`server_name ${domain.replaceAll('.', '\\.')}\\;`));
    assert.match(rendered, new RegExp(`return 308 https:\\/\\/${domain.replaceAll('.', '\\.')}\\$request_uri`));
    assert.match(rendered, new RegExp(`proxy_set_header Host ${domain.replaceAll('.', '\\.')}\\;`));
    assert.doesNotMatch(rendered, /\{\{[A-Z_]+\}\}/);
    assert.doesNotMatch(rendered, /\$host/);
  }
});

test('derives DOMAIN only from a strictly validated PUBLIC_BASE_URL', () => {
  assert.equal(deriveDomain('https://APP.Customer.Example/peaks'), 'app.customer.example');
  for (const invalid of [
    'http://app.customer.example/peaks/',
    'https://localhost/peaks/',
    'https://127.0.0.1/peaks/',
    'https://app.customer.example:8443/peaks/',
    'https://app.customer.example/admin/',
    'https://app.customer.example/peaks/?x=1',
    'https://app.customer.example/peaks/?',
    'https://app.customer.example/peaks/#x',
    'https://app.customer.example/peaks/#',
    'https://evil.example/peaks/\nserver_name attacker.example'
  ]) {
    assert.throws(() => deriveDomain(invalid));
  }
});

test('rejects unsafe deployment paths and unknown placeholders', () => {
  assert.throws(() => renderPeaksNginx({
    ...common,
    publicBaseUrl: 'https://app.customer.example/peaks/',
    deploymentRoot: '/srv/the-peaks-factory; include /tmp/evil'
  }));
  assert.throws(() => renderPeaksNginx({
    ...common,
    publicBaseUrl: 'https://app.customer.example/peaks/',
    template: 'server_name {{UNREVIEWED_VALUE}};'
  }));
  assert.throws(() => renderPeaksNginx({
    ...common,
    publicBaseUrl: 'https://app.customer.example/peaks/',
    tlsCertificateKey: '/srv/the-peaks-factory/current/forbidden-key.pem'
  }));
});
