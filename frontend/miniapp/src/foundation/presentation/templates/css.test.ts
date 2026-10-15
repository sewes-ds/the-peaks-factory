import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('presentation screen template CSS contract', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/foundation/presentation/templates/templates.css'), 'utf8');

  it('keeps slot items intrinsic, non-shrinking and scroll ownership singular', () => {
    const itemRule = css.match(/\.peaks-presentation-template-item\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(itemRule).toMatch(/flex:\s*0 0 auto/);
    expect(itemRule).toMatch(/height:\s*auto/);
    expect(itemRule).toMatch(/align-self:\s*stretch/);
    expect(itemRule).not.toMatch(/max-height\s*:/);
    expect(css).toMatch(/__scroll\s*\{[\s\S]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.peaks-presentation-screen-template\s*\{[\s\S]*max-height:\s*100dvh/);
  });
});
