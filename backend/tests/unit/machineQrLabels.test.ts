import { describe, expect, it } from 'vitest';
import { buildMachineQrPayload, validateMachineLabelRows } from '../../scripts/generate-machine-qr-labels.js';

describe('protected machine QR label contract', () => {
  it('builds only the accepted versioned payload and keeps all machine rows unique', () => {
    const rows = validateMachineLabelRows([
      { machine_id: '2', machine_name: 'Б', machine_qr_token: 'B'.repeat(32) },
      { machine_id: '1', machine_name: 'А', machine_qr_token: 'A'.repeat(32) },
    ], 2);
    expect(rows.map((row) => row.machine_id)).toEqual(['1', '2']);
    expect(buildMachineQrPayload(rows[0]!.machine_qr_token)).toBe(`peaks-machine:v1:${'A'.repeat(32)}`);
  });

  it('rejects invalid and duplicate protected token input without printing a token', () => {
    expect(() => buildMachineQrPayload('invalid')).toThrow('Machine QR token contract is invalid.');
    expect(() => validateMachineLabelRows([
      { machine_id: '1', machine_name: 'А', machine_qr_token: 'A'.repeat(32) },
      { machine_id: '2', machine_name: 'Б', machine_qr_token: 'A'.repeat(32) },
    ], 2)).toThrow('Duplicate machine QR token.');
  });
});
