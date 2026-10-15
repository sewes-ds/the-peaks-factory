import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  section03GeneratedBackendPresentationVectors,
  type Section03BackendPresentationTuple,
} from '../generated/managerPresentationContract';
import { resolveSection03BackendPresentationTuple } from './backendTuplePolicy';

function resolved(input: Section03BackendPresentationTuple) {
  const result = resolveSection03BackendPresentationTuple(input);
  expect(result.status).toBe('resolved');
  if (result.status !== 'resolved') {
    throw new Error('Expected a resolved canonical tuple.');
  }
  return result;
}

describe('Section 03 backend tuple policy', () => {
  it('resolves every backend-generated vector through Section policy and Platform Core to a global recipe', () => {
    for (const vector of section03GeneratedBackendPresentationVectors()) {
      const result = resolved(vector);
      expect(result.authority).toBe('BACKEND_STATE');
      expect(result.base.kind).toBe('state');
      expect(result.base.recipe).toMatchObject({
        surface: 'list-button',
        preserveStateToneWhenDisabled: true,
      });
      expect(result.base.recipe.fill).toBeDefined();
    }
  });

  it('maps the canonical waiting_accrual tuple to state-positive/green recipe', () => {
    const result = resolved({
      family: 'additional_work',
      tuple: { status: 'waiting_accrual', ui_variant: 'green' },
    });
    expect(result.base).toMatchObject({
      binding: { key: 'state-positive' },
      recipe: { fill: { tone: 'positive' } },
    });
  });

  it('returns a safe external error for an impossible backend tuple without a fallback recipe', () => {
    const result = resolveSection03BackendPresentationTuple({
      family: 'additional_work',
      tuple: { status: 'waiting_accrual', ui_variant: 'yellow' },
    });
    expect(result).toMatchObject({
      status: 'external-error',
      contractCode: 'UNKNOWN_BACKEND_PRESENTATION_TUPLE',
    });
    expect(result).not.toHaveProperty('base');
  });

  it('contains adapters and ownership only, not a manually maintained tuple table', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/section03/presentation/backendTuplePolicy.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/waiting_accrual|shift_not_started|critical_down|OPERATIONAL_DOWNTIME_OVER_15_MIN/);
    expect(source).not.toMatch(/ui_state\s*:\s*['"]|status\s*:\s*['"]|task_kind\s*:\s*['"]/);
  });
});
