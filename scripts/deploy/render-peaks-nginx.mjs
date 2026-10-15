#!/usr/bin/env node

import { isIP } from 'node:net';
import {
  readFileSync,
  realpathSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultTemplatePath = resolve(scriptDirectory, '../../deploy/vds/nginx/peaks-site.conf.template');
const placeholderPattern = /{{([A-Z_]+)}}/g;
const pathPattern = /^\/[A-Za-z0-9._/-]+$/;
const hostLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function deriveDomain(publicBaseUrl) {
  if (
    typeof publicBaseUrl !== 'string'
    || /[\s\u0000-\u001f\u007f\\]/u.test(publicBaseUrl)
  ) {
    throw new Error('PUBLIC_BASE_URL must not contain whitespace, controls or backslashes');
  }
  let parsed;
  try {
    parsed = new URL(publicBaseUrl);
  } catch {
    throw new Error('PUBLIC_BASE_URL must be an absolute URL');
  }

  const ipCandidate = parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
    ? parsed.hostname.slice(1, -1)
    : parsed.hostname;
  const labels = parsed.hostname.split('.');
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.search !== ''
    || publicBaseUrl.includes('?')
    || parsed.hash !== ''
    || publicBaseUrl.includes('#')
    || (parsed.pathname !== '/peaks' && parsed.pathname !== '/peaks/')
    || parsed.port !== ''
    || parsed.hostname === 'localhost'
    || parsed.hostname.endsWith('.localhost')
    || parsed.hostname.endsWith('.')
    || isIP(ipCandidate) !== 0
    || parsed.hostname.length > 253
    || !parsed.hostname.includes('.')
    || labels.some((label) => !hostLabelPattern.test(label))
  ) {
    throw new Error('PUBLIC_BASE_URL must be a public HTTPS FQDN with the exact /peaks/ path');
  }

  return parsed.hostname;
}

export function renderPeaksNginx({
  publicBaseUrl,
  tlsCertificate,
  tlsCertificateKey,
  deploymentRoot,
  template = readFileSync(defaultTemplatePath, 'utf8')
}) {
  const normalizedDeploymentRoot = validateAbsolutePath(deploymentRoot, 'deployment root');
  const normalizedCertificate = validateAbsolutePath(tlsCertificate, 'TLS certificate');
  const normalizedCertificateKey = validateAbsolutePath(tlsCertificateKey, 'TLS certificate key');
  assertOutsideDeploymentRoot(normalizedCertificate, normalizedDeploymentRoot, 'TLS certificate');
  assertOutsideDeploymentRoot(normalizedCertificateKey, normalizedDeploymentRoot, 'TLS certificate key');
  const values = {
    DOMAIN: deriveDomain(publicBaseUrl),
    TLS_CERTIFICATE: normalizedCertificate,
    TLS_CERTIFICATE_KEY: normalizedCertificateKey,
    DEPLOYMENT_ROOT: normalizedDeploymentRoot
  };

  const rendered = template.replace(placeholderPattern, (_match, name) => {
    if (!Object.hasOwn(values, name)) {
      throw new Error(`Unknown nginx template placeholder: ${name}`);
    }
    return values[name];
  });
  if (placeholderPattern.test(rendered)) {
    throw new Error('Unresolved nginx template placeholder');
  }
  if (rendered.includes('$host')) {
    throw new Error('Rendered nginx config must not trust the request Host for redirects or proxying');
  }

  return rendered;
}

function validateAbsolutePath(value, description) {
  if (
    typeof value !== 'string'
    || !isAbsolute(value)
    || normalize(value) !== value
    || !pathPattern.test(value)
    || value.split(sep).includes('..')
  ) {
    throw new Error(`${description} must be a normalized absolute path`);
  }
  return value;
}

function assertOutsideDeploymentRoot(path, deploymentRoot, description) {
  const relativePath = relative(deploymentRoot, path);
  if (relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..')) {
    throw new Error(`${description} must be outside the immutable deployment root`);
  }
}

function parseArguments(arguments_) {
  const values = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('Every renderer option requires one value');
    }
    values[key.slice(2)] = value;
  }

  const required = [
    'public-base-url',
    'tls-certificate',
    'tls-certificate-key',
    'deployment-root',
    'output'
  ];
  if (Object.keys(values).sort().join('\0') !== [...required].sort().join('\0')) {
    throw new Error(`Renderer options must be exactly: ${required.join(', ')}`);
  }
  return values;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const output = validateAbsolutePath(options.output, 'output');
  const deploymentRoot = validateAbsolutePath(options['deployment-root'], 'deployment root');
  assertOutsideDeploymentRoot(output, deploymentRoot, 'output');
  const rendered = renderPeaksNginx({
    publicBaseUrl: options['public-base-url'],
    tlsCertificate: options['tls-certificate'],
    tlsCertificateKey: options['tls-certificate-key'],
    deploymentRoot
  });

  writeFileSync(output, rendered, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  process.stdout.write(`PEAKS_NGINX_RENDER_PASS output=${realpathSync(output)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`PEAKS_NGINX_RENDER_FAIL: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}
