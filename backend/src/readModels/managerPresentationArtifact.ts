import { createHash } from 'node:crypto';
import {
  createManagerPresentationCanonicalVectors,
  type ManagerPresentationCanonicalVector
} from './managerPresentationContract.js';

export const MANAGER_PRESENTATION_CONTRACT_ID = 'manager-presentation-tuples-v1';
export const MANAGER_PRESENTATION_CONTRACT_SCHEMA_VERSION = 1;

export type ManagerPresentationContractPayload = Readonly<{
  schema_version: typeof MANAGER_PRESENTATION_CONTRACT_SCHEMA_VERSION;
  contract_id: typeof MANAGER_PRESENTATION_CONTRACT_ID;
  vectors: readonly ManagerPresentationCanonicalVector[];
}>;

export type ManagerPresentationContractArtifact = ManagerPresentationContractPayload & Readonly<{
  producer_commit: string;
  fingerprint_algorithm: 'sha256';
  fingerprint: string;
}>;

function assertProducerCommit(value: string): void {
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error('INVALID_PRESENTATION_CONTRACT_PRODUCER_COMMIT');
  }
}

export function createManagerPresentationContractPayload(): ManagerPresentationContractPayload {
  return Object.freeze({
    schema_version: MANAGER_PRESENTATION_CONTRACT_SCHEMA_VERSION,
    contract_id: MANAGER_PRESENTATION_CONTRACT_ID,
    vectors: createManagerPresentationCanonicalVectors()
  });
}

export function fingerprintManagerPresentationContract(
  payload: ManagerPresentationContractPayload
): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function createManagerPresentationContractArtifact(
  producerCommit: string
): ManagerPresentationContractArtifact {
  assertProducerCommit(producerCommit);
  const payload = createManagerPresentationContractPayload();
  return Object.freeze({
    ...payload,
    producer_commit: producerCommit,
    fingerprint_algorithm: 'sha256' as const,
    fingerprint: fingerprintManagerPresentationContract(payload)
  });
}

export function serializeManagerPresentationContractArtifact(
  producerCommit: string
): string {
  return `${JSON.stringify(createManagerPresentationContractArtifact(producerCommit), null, 2)}\n`;
}
