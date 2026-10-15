import { describe, expect, it } from 'vitest';

import { SECTION03_BACK_REGISTRY } from './back';
import { decodeSection03Context, isSection03ContextScalarOnly } from './context';
import { SECTION03_NODE_IDS } from './ids';
import { SECTION03_NODE_REGISTRY, validateSection03NodeContext } from './registry';
import { assertSection03Reachability, reachableSection03Nodes, SECTION03_FORWARD_TARGETS } from './reachability';

describe('complete Section 03 registry', () => {
  it('contains exactly 70 unique node, Back and definition keys', () => {
    expect(SECTION03_NODE_IDS).toHaveLength(70);
    expect(new Set(SECTION03_NODE_IDS).size).toBe(70);
    expect(Object.keys(SECTION03_NODE_REGISTRY)).toEqual(SECTION03_NODE_IDS);
    expect(new Set(Object.keys(SECTION03_BACK_REGISTRY))).toEqual(new Set(SECTION03_NODE_IDS));
  });

  it('has the exact family counts and a loader decision for every node', () => {
    const counts = Object.values(SECTION03_NODE_REGISTRY).reduce<Record<string, number>>((result, node) => {
      result[node.family] = (result[node.family] ?? 0) + 1;
      expect(node.loader === null || node.loader.length > 0).toBe(true);
      expect(node.fixtureKey).toBe(`fixture:${node.id}`);
      return result;
    }, {});
    expect(counts).toEqual({
      main: 1,
      machines: 5,
      downtimes: 5,
      employees: 12,
      'additional-works': 16,
      salary: 2,
      corrections: 22,
      notifications: 1,
      reports: 6,
    });
  });

  it('reaches all 70 nodes from the root with no unknown transition target', () => {
    expect(() => assertSection03Reachability()).not.toThrow();
    expect(reachableSection03Nodes().size).toBe(70);
    for (const targets of Object.values(SECTION03_FORWARD_TARGETS)) {
      expect(targets.every((target) => SECTION03_NODE_IDS.includes(target))).toBe(true);
    }
  });

  it('accepts scalar-only closed context and rejects records, arrays and unknown keys', () => {
    const decoded = decodeSection03Context({ employee_id: ' E-1 ', refresh_nonce: 2, period: 'week' });
    expect(decoded).toEqual({ employee_id: 'E-1', refresh_nonce: 2, period: 'week' });
    expect(isSection03ContextScalarOnly(decoded)).toBe(true);
    expect(() => decodeSection03Context({ employee: { employee_id: 'E-1' } })).toThrow('unknown field');
    expect(() => decodeSection03Context({ employee_id: ['E-1'] })).toThrow('scalar string');
    expect(() => decodeSection03Context({ period: 'year' })).toThrow('closed period');
  });

  it('fails closed on missing node context and enforces correction scope exclusivity', () => {
    expect(() => validateSection03NodeContext('S03-M02', {})).toThrow('machine_id');
    expect(() => validateSection03NodeContext('S03-CP12', { period: 'week' })).toThrow('explicit matching correction scope');
    expect(() => validateSection03NodeContext('S03-CP12', { period: 'week', correction_scope: 'employee', employee_id: 'E-1', machine_id: 'M-1' })).toThrow('explicit matching correction scope');
    expect(() => validateSection03NodeContext('S03-CP12', { period: 'week', correction_scope: 'employee', employee_id: 'E-1' })).not.toThrow();
    for (const [nodeId, context] of [
      ['S03-CF12', { employee_id: 'E-1', employee_shift_id: 'ES-1', correction_mode: 'accrual' }],
      ['S03-CF13', { employee_id: 'E-1', employee_shift_id: 'ES-1', correction_mode: 'accrual', amount_uzs: '100' }],
      ['S03-CF14', { employee_id: 'E-1', employee_shift_id: 'ES-1', correction_mode: 'accrual', amount_uzs: '100', financial_correction_reason: 'reason' }],
    ] as const) {
      expect(() => validateSection03NodeContext(nodeId, context)).toThrow('salary_correction_type_id');
    }
  });

  it('requires exact explicit report dates and keeps a valid predefined period as optional metadata', () => {
    expect(() => validateSection03NodeContext('S03-R13', { from_date: '2026-07-01', to_date: '2026-07-31' })).not.toThrow();
    expect(() => validateSection03NodeContext('S03-R13', { period: 'month', from_date: '2026-07-01', to_date: '2026-07-31' })).not.toThrow();
    expect(() => validateSection03NodeContext('S03-R13', {})).toThrow('from_date');
    expect(() => validateSection03NodeContext('S03-R13', { period: 'month' })).toThrow('from_date');
    expect(() => validateSection03NodeContext('S03-R13', { from_date: '2026-07-01' })).toThrow('to_date');
    expect(() => validateSection03NodeContext('S03-R13', { from_date: '2026-8-01', to_date: '2026-08-04' })).toThrow('INVALID_REPORT_DATE');
    expect(() => validateSection03NodeContext('S03-R13', { from_date: '2026-02-29', to_date: '2026-08-04' })).toThrow('INVALID_REPORT_DATE');
    expect(() => validateSection03NodeContext('S03-R13', { from_date: '2026-08-01', to_date: '2026-07-31' })).toThrow('INVALID_REPORT_RANGE');
  });

  it('declares only terminal root and true history Back rules', () => {
    expect(SECTION03_BACK_REGISTRY['S03-N01']).toEqual({ kind: 'terminal' });
    for (const nodeId of SECTION03_NODE_IDS.filter((candidate) => candidate !== 'S03-N01')) {
      expect(SECTION03_BACK_REGISTRY[nodeId], nodeId).toEqual({ kind: 'history' });
    }
  });
});
