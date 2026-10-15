import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/foundation/peaksTheme.css'), 'utf8');
const oldBlueHex = ['#006', 'BFF'].join('');
const oldBluePattern = new RegExp(`${oldBlueHex}|rgb\\(0, ?107, ?255\\)|rgba\\(0, ?107, ?255`);

describe('theme tokens', () => {
  it('uses the accepted PEAKS blue token', () => {
    expect(tokensCss).toContain('#0861BB');
  });

  it('does not use the superseded blue token', () => {
    expect(tokensCss).not.toMatch(oldBluePattern);
  });
});
