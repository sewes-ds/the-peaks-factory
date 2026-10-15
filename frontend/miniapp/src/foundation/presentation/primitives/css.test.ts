import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  resolve(process.cwd(), 'src/foundation/presentation/primitives/primitives.css'),
  'utf8',
);

describe('presentation primitive CSS contract', () => {
  it('contains every fixed primitive and feedback selector', () => {
    for (const selector of [
      '.peaks-presentation-action-button',
      '.peaks-presentation-control-list-button',
      '.peaks-presentation-state-list-button',
      '.peaks-presentation-entity-row',
      '.peaks-presentation-card',
      '.peaks-presentation-card__line--content',
      '.peaks-presentation-card__content',
      '.peaks-presentation-summary-line',
      '.peaks-presentation-message',
      '.peaks-presentation-feedback-block',
      '.peaks-presentation-feedback--muted',
      '.peaks-presentation-spinner',
    ]) {
      expect(css).toContain(selector);
    }
  });

  it('uses token-only feedback values and reduced motion', () => {
    expect(css).toContain(
      'opacity: var(--peaks-feedback-disabled-opacity)',
    );
    expect(css).toContain('var(--peaks-feedback-spinner-duration)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('currentColor');
    expect(css).toContain('transparent');
    expect(css).not.toMatch(/\b0\.58\b|\b0\.8s\b/);
  });

  it('contains no raw color, application selector or screen layout', () => {
    expect(css).not.toMatch(/#[0-9A-Fa-f]{3,8}\b|rgba?\s*\(/);
    expect(css).not.toMatch(/section0[23]|peaks-graph-/i);
    expect(css).not.toMatch(
      /\bposition\s*:\s*(?:fixed|sticky|absolute)|\b(?:100v[wh]|100dvh)\b|\bz-index\s*:/,
    );
    expect(css).not.toMatch(/\b(?:max-)?height\s*:\s*\d/);
  });
});
