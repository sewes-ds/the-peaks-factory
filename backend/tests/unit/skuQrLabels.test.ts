import { describe, expect, it } from 'vitest';
import { buildSkuQrPayload, validateSkuLabelRows } from '../../scripts/generate-sku-qr-labels.js';

describe('protected SKU QR label contract', () => {
  it('sorts SKU labels and builds only the accepted versioned payload', () => {
    const rows = validateSkuLabelRows([
      { sku_id: '2', sku_code: 'SKU-10', sku_name: 'Б', sku_qr_token: 'B'.repeat(32) },
      { sku_id: '1', sku_code: 'SKU-2', sku_name: 'А', sku_qr_token: 'A'.repeat(32) },
    ], 2);
    expect(rows.map((row) => row.sku_id)).toEqual(['1', '2']);
    expect(buildSkuQrPayload(rows[0]!.sku_qr_token)).toBe(`peaks-sku:v1:${'A'.repeat(32)}`);
  });

  it('rejects invalid or duplicate protected tokens without printing them', () => {
    expect(() => buildSkuQrPayload('invalid')).toThrow('SKU QR token contract is invalid.');
    expect(() => validateSkuLabelRows([
      { sku_id: '1', sku_code: 'SKU-1', sku_name: 'А', sku_qr_token: 'A'.repeat(32) },
      { sku_id: '2', sku_code: 'SKU-2', sku_name: 'Б', sku_qr_token: 'A'.repeat(32) },
    ], 2)).toThrow('Duplicate SKU label identity or QR token.');
  });
});
