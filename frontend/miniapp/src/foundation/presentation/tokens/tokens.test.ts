import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PEAKS_COLOR_TOKENS,
  PEAKS_FEEDBACK_TOKENS,
  PEAKS_GEOMETRY_TOKENS,
  PEAKS_INPUT_TOKENS,
  PEAKS_TYPOGRAPHY_TOKENS,
} from './index';

function leaves(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }

  return Object.values(value).flatMap(leaves);
}

function objects(value: unknown): object[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }

  return [value, ...Object.values(value).flatMap(objects)];
}

const registry = [
  PEAKS_COLOR_TOKENS,
  PEAKS_GEOMETRY_TOKENS,
  PEAKS_TYPOGRAPHY_TOKENS,
  PEAKS_INPUT_TOKENS,
  PEAKS_FEEDBACK_TOKENS,
] as const;

describe('global presentation CSS token registry', () => {
  it('has exact one-to-one coverage of the CSS authority', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/foundation/peaksTheme.css'),
      'utf8',
    );
    const cssVariables = [...css.matchAll(/(--peaks-[a-z0-9-]+)\s*:/g)]
      .map((match) => match[1]);
    const references = registry.flatMap(leaves);
    const referenceVariables = references.map((reference) => {
      const match = /^var\((--peaks-[a-z0-9-]+)\)$/.exec(reference);
      expect(match).not.toBeNull();
      return match?.[1] ?? '';
    });

    expect(new Set(cssVariables).size).toBe(cssVariables.length);
    expect(new Set(referenceVariables).size).toBe(referenceVariables.length);
    expect(referenceVariables.sort()).toEqual([...cssVariables].sort());
  });

  it('freezes token groups and exposes only CSS variable references as leaves', () => {
    for (const tokenGroup of registry) {
      for (const object of objects(tokenGroup)) {
        expect(Object.isFrozen(object)).toBe(true);
      }
    }

    expect(registry.flatMap(leaves).every((value) => /^var\(--peaks-[a-z0-9-]+\)$/.test(value))).toBe(true);
  });

  it('keeps physical blue and every other physical value in CSS only', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/foundation/peaksTheme.css'),
      'utf8',
    );
    const source = registry.flatMap(leaves).join('\n');

    expect(css).toContain('#0861BB');
    expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}|rgb\(/);
  });

  it('closes exact 70-token coverage with two feedback tokens', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/foundation/peaksTheme.css'),
      'utf8',
    );
    const cssVariables = [...css.matchAll(/(--peaks-[a-z0-9-]+)\s*:/g)]
      .map((match) => match[1]);

    expect(cssVariables).toHaveLength(70);
    expect(PEAKS_FEEDBACK_TOKENS).toEqual({
      disabledOpacity: 'var(--peaks-feedback-disabled-opacity)',
      spinnerDuration: 'var(--peaks-feedback-spinner-duration)',
    });
  });
});
