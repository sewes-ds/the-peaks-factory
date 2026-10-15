import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const functionsSql = readFileSync(resolve(repoRoot, 'db/functions/functions.sql'), 'utf8');
const grantsSql = readFileSync(resolve(repoRoot, 'db/grants/grants.sql'), 'utf8');
const registryTs = readFileSync(resolve(repoRoot, 'backend/src/db/runtimeApiRegistry.ts'), 'utf8');

const expectedCounts = {
  runtime_api: 95,
  internal_helper: 82,
  maintenance_api: 1
};

const functionComments = [
  ...functionsSql.matchAll(/comment on function\s+app\.([a-z0-9_]+)\(([^)]*)\)\s+is\s+'([^']*)'/gi)
].map((match) => ({
  name: match[1],
  args: normalizeArgs(match[2]),
  signature: `${match[1]}(${normalizeArgs(match[2])})`,
  comment: match[3]
}));

const counts = {
  runtime_api: countClassified('runtime_api'),
  internal_helper: countClassified('internal_helper'),
  maintenance_api: countClassified('maintenance_api')
};

const runtimeComments = functionComments.filter((entry) => entry.comment.startsWith('runtime_api:'));
const helperComments = functionComments.filter((entry) => entry.comment.startsWith('internal_helper:'));
const maintenanceComments = functionComments.filter((entry) => entry.comment.startsWith('maintenance_api:'));

const runtimeGrants = [
  ...grantsSql.matchAll(/grant execute on function app\.([a-z0-9_]+)\(([^)]*)\) to app_runtime_role;/gi)
].map((match) => ({
  name: match[1],
  args: normalizeArgs(match[2]),
  signature: `${match[1]}(${normalizeArgs(match[2])})`
}));

const registrySignatures = [
  ...registryTs.matchAll(/signature:\s+'([a-z0-9_]+\([^']*\))'/gi)
].map((match) => match[1]);

const failures = [];

for (const [key, expected] of Object.entries(expectedCounts)) {
  if (counts[key] !== expected) {
    failures.push(`${key} count expected ${expected}, got ${counts[key]}`);
  }
}

assertSameSet(
  'runtime comments vs runtime grants',
  runtimeComments.map((entry) => entry.signature),
  runtimeGrants.map((entry) => entry.signature),
  failures
);

assertSameSet(
  'runtime registry vs runtime grants',
  registrySignatures,
  runtimeGrants.map((entry) => entry.signature),
  failures
);

const registryNames = new Set(registrySignatures.map((signature) => signature.slice(0, signature.indexOf('('))));
for (const entry of [...helperComments, ...maintenanceComments]) {
  if (registryNames.has(entry.name)) {
    failures.push(`forbidden non-runtime function in registry: ${entry.signature}`);
  }
}

if (failures.length > 0) {
  console.error('RUNTIME_API_MAP_VERIFY_FAIL');
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log('RUNTIME_API_MAP_VERIFY_PASS');
console.log(`runtime_api=${counts.runtime_api}`);
console.log(`internal_helper=${counts.internal_helper}`);
console.log(`maintenance_api=${counts.maintenance_api}`);
console.log(`registry_runtime_api=${registrySignatures.length}`);

function countClassified(classification) {
  return functionComments.filter((entry) => entry.comment.startsWith(`${classification}:`)).length;
}

function normalizeArgs(args) {
  return args.trim().replace(/\s+/g, ' ');
}

function assertSameSet(label, actualList, expectedList, failures) {
  const actual = new Set(actualList);
  const expected = new Set(expectedList);

  for (const item of expected) {
    if (!actual.has(item)) {
      failures.push(`${label}: missing ${item}`);
    }
  }

  for (const item of actual) {
    if (!expected.has(item)) {
      failures.push(`${label}: unexpected ${item}`);
    }
  }

  if (actual.size !== actualList.length) {
    failures.push(`${label}: duplicate item in actual list`);
  }
}
