#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, normalize, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '..');
const failures = [];

const requiredDocuments = new Map([
  ['README.md', /Source available — not open source/],
  ['LICENSE', /NO GENERAL LICENSE/],
  ['CONTRIBUTING.md', /does not currently accept unsolicited/],
  ['SECURITY.md', /Report a vulnerability/],
  ['THIRD_PARTY_NOTICES.md', /SIL Open Font License 1\.1/],
  ['docs/PROJECT_STATUS.md', /Published baseline/],
  ['docs/ARCHITECTURE.md', /PostgreSQL 16/],
  ['docs/TESTING.md', /Total automated test cases/],
  ['docs/DEPLOYMENT.md', /Release gate/],
]);

function trackedMarkdownFiles() {
  const result = spawnSync('git', ['ls-files', '-z', '--', '*.md'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`cannot enumerate documentation: ${result.stderr.trim()}`);
  }
  return result.stdout.split('\0').filter(Boolean).sort();
}

function cleanLinkTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().replace(/\s+["'][^"']*["']$/u, '');
  const unwrapped = withoutTitle.startsWith('<') && withoutTitle.endsWith('>')
    ? withoutTitle.slice(1, -1)
    : withoutTitle;
  return decodeURIComponent(unwrapped.split('#', 1)[0]);
}

for (const [relativePath, requiredPattern] of requiredDocuments) {
  const absolutePath = resolve(repositoryRoot, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath}: required document is missing`);
    continue;
  }
  if (!requiredPattern.test(readFileSync(absolutePath, 'utf8'))) {
    failures.push(`${relativePath}: required publication marker is missing`);
  }
}

const forbiddenPublicationReferences = [
  { pattern: /\/home\/devops/iu, message: 'contains a private workstation path' },
  { pattern: /\btrigradar\.ru\b/iu, message: 'contains a non-publication domain' },
  { pattern: /\bsewes-ds\.ru\b/iu, message: 'contains a non-publication domain' },
  { pattern: /docs\/(?:project|operations|graph-runtime-v2|passports)\//iu, message: 'links to excluded internal documentation' },
  { pattern: /backend\/_work\//iu, message: 'links to excluded work-package material' },
  { pattern: /upgrade\/[^\s)`]*/iu, message: 'links to excluded upgrade work material' },
];

for (const relativePath of trackedMarkdownFiles()) {
  const absolutePath = resolve(repositoryRoot, relativePath);
  const content = readFileSync(absolutePath, 'utf8');

  for (const rule of forbiddenPublicationReferences) {
    if (rule.pattern.test(content)) failures.push(`${relativePath}: ${rule.message}`);
  }

  const inlineLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  const referenceLinkPattern = /^\s*\[[^\]]+\]:\s*(\S+)/gmu;
  const targets = [
    ...content.matchAll(inlineLinkPattern),
    ...content.matchAll(referenceLinkPattern),
  ].map((match) => match[1]);

  for (const rawTarget of targets) {
    let target;
    try {
      target = cleanLinkTarget(rawTarget);
    } catch {
      failures.push(`${relativePath}: malformed encoded link target ${rawTarget}`);
      continue;
    }

    if (
      target === ''
      || target.startsWith('#')
      || /^[a-z][a-z0-9+.-]*:/iu.test(target)
      || target.startsWith('//')
    ) continue;

    if (isAbsolute(target)) {
      failures.push(`${relativePath}: local Markdown link must be repository-relative: ${target}`);
      continue;
    }

    const resolvedTarget = normalize(resolve(dirname(absolutePath), target));
    if (!resolvedTarget.startsWith(`${repositoryRoot}/`) && resolvedTarget !== repositoryRoot) {
      failures.push(`${relativePath}: link escapes the repository: ${target}`);
    } else if (!existsSync(resolvedTarget)) {
      failures.push(`${relativePath}: broken relative link: ${target}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`DOCUMENTATION_VERIFY_FAIL (${failures.length})\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`DOCUMENTATION_VERIFY_PASS required=${requiredDocuments.size}\n`);
