import { describe, expect, it } from 'vitest';
import {
  createManagerPresentationContractArtifact,
  createManagerPresentationContractPayload,
  fingerprintManagerPresentationContract,
  serializeManagerPresentationContractArtifact
} from '../../src/readModels/managerPresentationArtifact.js';
import {
  MANAGER_PRESENTATION_TUPLE_DEFINITIONS,
  ManagerPresentationContractError,
  createManagerPresentationCanonicalVectors,
  resolveManagerAdditionalWorkPresentation,
  resolveManagerEmployeePresentation,
  resolveManagerMachinePresentation,
  resolveManagerNotificationPresentation
} from '../../src/readModels/managerPresentationContract.js';

const producerCommit = '0123456789abcdef0123456789abcdef01234567';

describe('manager generated presentation contract', () => {
  it('derives canonical vectors from the same definitions used by runtime resolvers', () => {
    const vectors = createManagerPresentationCanonicalVectors();
    expect(vectors).toHaveLength(19);
    expect(vectors).toEqual([
      ...MANAGER_PRESENTATION_TUPLE_DEFINITIONS.machine.map(({ state }) => ({
        family: 'machine', tuple: resolveManagerMachinePresentation(state)
      })),
      ...MANAGER_PRESENTATION_TUPLE_DEFINITIONS.employee.map(({ state }) => ({
        family: 'employee', tuple: resolveManagerEmployeePresentation(state)
      })),
      ...MANAGER_PRESENTATION_TUPLE_DEFINITIONS.additional_work.map(({ state }) => ({
        family: 'additional_work', tuple: resolveManagerAdditionalWorkPresentation(state)
      })),
      ...MANAGER_PRESENTATION_TUPLE_DEFINITIONS.notification.map(({ state }) => ({
        family: 'notification', tuple: resolveManagerNotificationPresentation(state)
      }))
    ]);

    const identities = vectors.map((vector) => {
      const state = vector.tuple.ui_state ?? vector.tuple.status ?? vector.tuple.task_kind;
      return `${vector.family}:${state}`;
    });
    expect(new Set(identities).size).toBe(identities.length);
  });

  it('publishes waiting_accrual green and never publishes the historical yellow tuple', () => {
    const vectors = createManagerPresentationCanonicalVectors();
    expect(vectors).toContainEqual({
      family: 'additional_work',
      tuple: { status: 'waiting_accrual', ui_variant: 'green' }
    });
    expect(vectors).not.toContainEqual({
      family: 'additional_work',
      tuple: { status: 'waiting_accrual', ui_variant: 'yellow' }
    });
  });

  it('fails closed for an unknown runtime state', () => {
    expect(() => resolveManagerAdditionalWorkPresentation('unknown' as never))
      .toThrowError(new ManagerPresentationContractError('UNKNOWN_PRESENTATION_STATE'));
  });

  it('serializes deterministically with a producer commit and content fingerprint', () => {
    const first = serializeManagerPresentationContractArtifact(producerCommit);
    const second = serializeManagerPresentationContractArtifact(producerCommit);
    const artifact = createManagerPresentationContractArtifact(producerCommit);

    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual(artifact);
    expect(artifact.producer_commit).toBe(producerCommit);
    expect(artifact.fingerprint).toBe(
      fingerprintManagerPresentationContract(createManagerPresentationContractPayload())
    );
    expect(artifact.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(() => createManagerPresentationContractArtifact('stale'))
      .toThrow('INVALID_PRESENTATION_CONTRACT_PRODUCER_COMMIT');
  });
});
