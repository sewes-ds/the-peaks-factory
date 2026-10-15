#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '..');
const failures = [];

function gitOutput(arguments_) {
  const result = spawnSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${arguments_.join(' ')} failed`);
  return result.stdout;
}

const paths = gitOutput(['ls-files', '-z']).split('\0').filter(Boolean).sort();
const forbiddenPathPatterns = [
  /^(?:\.agent_work|\.audit|upgrade)\//u,
  /^(?:backend\/_work|db\/_cleanup)\//u,
  /\/_work\//u,
  /^docs\/(?:archive|graph-runtime-v2|passports)\//u,
  /(^|\/)(?:dist|build|coverage)\//u,
];
const forbiddenExtensions = new Set([
  '.backup', '.crt', '.docx', '.dump', '.key', '.odt', '.p12', '.pem', '.pfx', '.tar', '.zip',
]);

for (const path of paths) {
  const name = basename(path);
  const extension = extname(name).toLowerCase();
  if (forbiddenPathPatterns.some((pattern) => pattern.test(path))) {
    failures.push(`${path}: internal, generated, or work-package path is tracked`);
  }
  if ((name === '.env' || name.startsWith('.env.')) && name !== '.env.example') {
    failures.push(`${path}: runtime environment file is tracked`);
  }
  if (forbiddenExtensions.has(extension) || path.endsWith('.tar.gz')) {
    failures.push(`${path}: private, binary-office, key, dump, or archive material is tracked`);
  }
}

const symlinks = gitOutput(['ls-files', '-s'])
  .split(/\r?\n/u)
  .filter((line) => line.startsWith('120000 '));
for (const symlink of symlinks) {
  failures.push(`${symlink.split('\t').at(-1)}: tracked symbolic links are not allowed in the public baseline`);
}

const highConfidencePatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { name: 'Telegram bot token', pattern: /\b\d{8,12}:[A-Za-z0-9_-]{35}\b/u },
  { name: 'GitHub token', pattern: /\b(?:gh[opurs]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/u },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
  { name: 'Stripe live key', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/u },
  { name: 'database URL with inline password', pattern: /postgres(?:ql)?:\/\/[^\s/:]+:(?!change-me@)[^\s/@]+@[^\s/]+/iu },
  { name: 'service-account private key', pattern: /"private_key"\s*:\s*"-----BEGIN/iu },
  { name: 'personal email address', pattern: /\b[^\s@]+@(?:gmail|yandex|mail|outlook)\.[a-z]{2,}\b/iu },
  { name: 'private workstation path', pattern: /\/home\/devops(?:\/|\b)/u },
  { name: 'non-publication domain', pattern: /\b(?:trigradar\.ru|sewes-ds\.ru)\b/iu },
];

let textFiles = 0;
let binaryFiles = 0;
for (const path of paths) {
  let content;
  try {
    content = readFileSync(resolve(repositoryRoot, path));
  } catch {
    failures.push(`${path}: tracked file cannot be read`);
    continue;
  }
  if (content.includes(0)) {
    binaryFiles += 1;
    continue;
  }
  textFiles += 1;
  const text = content.toString('utf8');
  for (const rule of highConfidencePatterns) {
    if (rule.pattern.test(text)) failures.push(`${path}: possible ${rule.name}; value suppressed`);
  }
}

const license = readFileSync(resolve(repositoryRoot, 'LICENSE'), 'utf8');
if (!license.includes('PROPRIETARY SOURCE TERMS') || /\[[A-Z _-]{3,}\]/u.test(license)) {
  failures.push('LICENSE: proprietary terms are absent or contain an unresolved placeholder');
}

if (failures.length > 0) {
  process.stderr.write(`REPOSITORY_HYGIENE_FAIL (${failures.length})\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  `REPOSITORY_HYGIENE_PASS tracked=${paths.length} text=${textFiles} binary=${binaryFiles}\n`,
);
