import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeManagerAdditionalWorksResponse } from '../contracts';
import { P3A4_WAITING_RESPONSE } from '../fixtures/p3a4AdditionalWorkAccrual';
import {
  SECTION03_BACKEND_PRESENTATION_CONTRACT_META,
  Section03GeneratedContractError,
  decodeSection03BackendPresentationTuple,
  section03GeneratedBackendPresentationVectors,
} from './managerPresentationContract';

const verifier = resolve(
  process.cwd(),
  'scripts/verify-manager-presentation-contract.mjs',
);
const artifactPath = resolve(
  process.cwd(),
  'src/section03/generated/managerPresentationContract.generated.json',
);
const lockPath = resolve(
  process.cwd(),
  'src/section03/generated/managerPresentationContract.lock.json',
);

describe('generated manager presentation contract', () => {
  it('loads the exact backend producer and all four canonical families', () => {
    const vectors = section03GeneratedBackendPresentationVectors();
    expect(SECTION03_BACKEND_PRESENTATION_CONTRACT_META).toEqual({
      producerCommit: '1d905143164e8e0067a024376c4e96487cbbbc7c',
      fingerprint: '217ed67f02f14a23d45f15fee2cabf20b2274942725201afc4970242a5c69b86',
      vectorCount: 19,
    });
    expect(new Set(vectors.map((vector) => vector.family))).toEqual(
      new Set(['machine', 'employee', 'additional_work', 'notification']),
    );
    for (const vector of vectors) {
      expect(decodeSection03BackendPresentationTuple(vector)).toBe(vector);
    }
  });

  it('accepts waiting_accrual green and rejects waiting_accrual yellow before projection', () => {
    expect(decodeSection03BackendPresentationTuple({
      family: 'additional_work',
      tuple: { status: 'waiting_accrual', ui_variant: 'green' },
    })).toMatchObject({
      family: 'additional_work',
      tuple: { status: 'waiting_accrual', ui_variant: 'green' },
    });
    expect(() => decodeSection03BackendPresentationTuple({
      family: 'additional_work',
      tuple: { status: 'waiting_accrual', ui_variant: 'yellow' },
    })).toThrowError(new Section03GeneratedContractError(
      'UNKNOWN_BACKEND_PRESENTATION_TUPLE',
    ));

    const incompatibleResponse = JSON.parse(
      JSON.stringify(P3A4_WAITING_RESPONSE),
    );
    incompatibleResponse.groups.waiting_accrual[0].ui_variant = 'yellow';
    expect(() => decodeManagerAdditionalWorksResponse(incompatibleResponse))
      .toThrowError(expect.objectContaining({
        code: 'INVALID_UI_VARIANT',
        path: '$.groups.waiting_accrual[0].presentation_tuple',
      }));
  });

  it('makes the generated fingerprint verifier a qualification gate', () => {
    const output = execFileSync(process.execPath, [verifier], {
      encoding: 'utf8',
    });
    expect(output).toContain('PPA3_GENERATED_CONTRACT_VERIFY_PASS');
    expect(output).toContain('vectors=19');
  });

  it('fails qualification for stale and tampered generated evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppa3-generated-contract-'));
    try {
      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
      const staleLock = {
        ...lock,
        producer_commit: '0000000000000000000000000000000000000000',
      };
      const tamperedArtifact = JSON.parse(JSON.stringify(artifact));
      tamperedArtifact.vectors[0].tuple.ui_variant = 'red';
      const stalePath = join(directory, 'stale-lock.json');
      const tamperedPath = join(directory, 'tampered-artifact.json');
      writeFileSync(stalePath, JSON.stringify(staleLock), 'utf8');
      writeFileSync(tamperedPath, JSON.stringify(tamperedArtifact), 'utf8');

      const stale = spawnSync(process.execPath, [
        verifier,
        '--artifact', artifactPath,
        '--lock', stalePath,
      ], { encoding: 'utf8' });
      expect(stale.status).not.toBe(0);
      expect(stale.stderr).toContain('STALE_GENERATED_CONTRACT');

      const tampered = spawnSync(process.execPath, [
        verifier,
        '--artifact', tamperedPath,
        '--lock', lockPath,
      ], { encoding: 'utf8' });
      expect(tampered.status).not.toBe(0);
      expect(tampered.stderr).toContain('TAMPERED_GENERATED_CONTRACT');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
