import { describe, expect, it } from 'vitest';
import { mutationPaths, operatorReadModelPaths } from './apiClient';

describe('operator read model paths', () => {
  it('uses the current additional work type catalog endpoint', () => {
    expect(operatorReadModelPaths.additionalWorkTypesAvailable).toBe('/operator/additional-work-types/available');
  });

  it('keeps the machine QR selector out of the request URL', () => {
    expect(operatorReadModelPaths.machineQr).toBe('/operator/machines/resolve-qr');
    expect(operatorReadModelPaths.skuQr).toBe('/operator/skus/resolve-qr');
    expect(JSON.stringify(operatorReadModelPaths)).not.toContain('/operator/machines/by-qr/');
  });

  it('does not expose additional work cancel as an MVP frontend binding', () => {
    expect(Object.values(mutationPaths).join('\n')).not.toContain('/cancel');
  });
});
