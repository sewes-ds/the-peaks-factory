import { describe, expect, it } from 'vitest';
import programSource from './program.ts?raw';
import { ApiClient } from '../foundation/apiClient';
import { createSection03Program } from './program';

describe('Section 03 Graph presentation authority mode', () => {
  it('uses the behavior-only platform action registry', () => {
    const program = createSection03Program(new ApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: async () => {
        throw new Error('No request expected while inspecting the program.');
      },
    }));

    expect(program.actions.presentationMode).toBe('platform-authority');
    for (const definition of [
      ...Object.values(program.actions.business),
      ...Object.values(program.actions.presentation),
    ]) {
      expect(definition).not.toHaveProperty('visual');
    }
  });

  it('contains no active Graph visual binding or unsafe visual compatibility cast', () => {
    expect(programSource).toContain('definePlatformGraphActions');
    expect(programSource).toContain('platformGraphAction');
    expect(programSource).not.toMatch(/graphAction\.(?:actionButton|listButton)/);
    expect(programSource).not.toContain('resolveSection03ControlBinding');
    expect(programSource).not.toMatch(/controlKey\s+as\s+unknown/);
    expect(programSource).not.toMatch(/definition\.visual/);
  });
});
