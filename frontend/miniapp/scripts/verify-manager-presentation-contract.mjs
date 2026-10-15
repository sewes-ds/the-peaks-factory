import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const defaultArtifact = fileURLToPath(new URL(
  '../src/section03/generated/managerPresentationContract.generated.json',
  import.meta.url,
));
const defaultLock = fileURLToPath(new URL(
  '../src/section03/generated/managerPresentationContract.lock.json',
  import.meta.url,
));

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`MISSING_${name.slice(2).replaceAll('-', '_').toUpperCase()}`);
  }
  return value;
}

function object(value, code) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(code);
  }
  return value;
}

export function verifyManagerPresentationContract(artifactInput, lockInput) {
  const artifact = object(artifactInput, 'INVALID_GENERATED_CONTRACT');
  const lock = object(lockInput, 'INVALID_GENERATED_CONTRACT_LOCK');
  if (
    artifact.schema_version !== 1 ||
    artifact.contract_id !== 'manager-presentation-tuples-v1' ||
    !Array.isArray(artifact.vectors) ||
    artifact.fingerprint_algorithm !== 'sha256' ||
    typeof artifact.producer_commit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(artifact.producer_commit) ||
    typeof artifact.fingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/.test(artifact.fingerprint)
  ) {
    throw new Error('INVALID_GENERATED_CONTRACT');
  }
  if (
    lock.contract_id !== artifact.contract_id ||
    lock.producer_commit !== artifact.producer_commit ||
    lock.fingerprint !== artifact.fingerprint
  ) {
    throw new Error('STALE_GENERATED_CONTRACT');
  }

  const payload = {
    schema_version: artifact.schema_version,
    contract_id: artifact.contract_id,
    vectors: artifact.vectors,
  };
  const actual = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  if (actual !== artifact.fingerprint) {
    throw new Error('TAMPERED_GENERATED_CONTRACT');
  }
  return Object.freeze({
    producerCommit: artifact.producer_commit,
    fingerprint: actual,
    vectorCount: artifact.vectors.length,
  });
}

async function main() {
  const artifactPath = argument('--artifact', defaultArtifact);
  const lockPath = argument('--lock', defaultLock);
  const [artifact, lock] = await Promise.all([
    readFile(artifactPath, 'utf8').then(JSON.parse),
    readFile(lockPath, 'utf8').then(JSON.parse),
  ]);
  const result = verifyManagerPresentationContract(artifact, lock);
  process.stdout.write(
    `PPA3_GENERATED_CONTRACT_VERIFY_PASS producer=${result.producerCommit} fingerprint=${result.fingerprint} vectors=${result.vectorCount}\n`,
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
