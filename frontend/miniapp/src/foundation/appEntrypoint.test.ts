import { describe, expect, it } from 'vitest';
import { appEntrypointPath } from './appEntrypoint';

describe('app entrypoint API contract', () => {
  it('uses backend-owned auth entrypoint resolver', () => {
    expect(appEntrypointPath).toBe('/auth/app-entrypoint');
  });
});
