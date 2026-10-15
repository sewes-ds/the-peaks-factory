import { describe, expect, it, vi } from 'vitest';
import { getDefaultApiBaseUrl, getMiniAppBaseUrl } from './runtimePaths';

describe('runtime paths', () => {
  it('keeps Mini App and API paths relative to the serving origin', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://attacker.example/api');

    expect(getMiniAppBaseUrl()).toBe('');
    expect(getDefaultApiBaseUrl()).toBe('/api');
    expect(getDefaultApiBaseUrl()).not.toMatch(/^https?:/);

    vi.unstubAllEnvs();
  });
});
