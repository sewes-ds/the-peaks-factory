import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditPlatformPresentationCss } from './cssAuthority';

const sourceRoot = resolve(process.cwd(), 'src');

function cssFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.isFile() && path.endsWith('.css') ? [path] : [];
  });
}

function audit(css: string, sourceId = 'src/section04/synthetic-consumer.css') {
  return auditPlatformPresentationCss({ sourceId, css }).violations;
}

describe('Platform CSS Presentation Authority', () => {
  it('keeps every repository stylesheet behind the architecture gate', () => {
    const violations = cssFiles(sourceRoot).flatMap((path) =>
      auditPlatformPresentationCss({
        sourceId: relative(process.cwd(), path),
        css: readFileSync(path, 'utf8'),
      }).violations);

    expect(violations).toEqual([]);
  });

  it.each([
    ['color', '.synthetic-state-positive .peaks-presentation-state-list-button { color: red; }'],
    ['background-color', '.synthetic-state-positive .peaks-presentation-state-list-button { background-color: red; }'],
    ['border-color', '.synthetic-state-positive .peaks-presentation-state-list-button { border-color: red; }'],
    ['context selector', '.synthetic-state-positive > .peaks-presentation-state-list-button:hover { color: red; }'],
  ])('rejects a synthetic Section 04 %s paint override', (_name, css) => {
    expect(audit(css)).toMatchObject([
      { code: 'SEMANTIC_PAINT_OVERRIDE' },
    ]);
  });

  it('rejects specificity and important as presentation bypasses', () => {
    expect(audit(`
      .test-domain.test-domain .peaks-presentation-state-list-button {
        background: red !important;
      }
    `)).toMatchObject([
      { code: 'SEMANTIC_PAINT_IMPORTANT_OVERRIDE' },
    ]);
  });

  it('rejects the same bypass inside conditional CSS', () => {
    expect(audit(`
      @media (max-width: 600px) {
        .synthetic-state-positive .peaks-presentation-state-list-button {
          color: red;
        }
      }
    `)).toMatchObject([
      { code: 'SEMANTIC_PAINT_OVERRIDE' },
    ]);
  });

  it('rejects semantic and physical palette variable overrides', () => {
    expect(audit(`
      .test-domain {
        --peaks-presentation-text: red;
        --peaks-green: red;
      }
    `)).toMatchObject([
      { code: 'SEMANTIC_VARIABLE_OVERRIDE' },
      { code: 'PALETTE_VARIABLE_OVERRIDE' },
    ]);
  });

  it('rejects unbounded component selectors that can recolor a primitive', () => {
    expect(audit(`
      .test-domain * { color: red; }
      .test-domain button { border-color: red; }
    `)).toMatchObject([
      { code: 'UNBOUNDED_SEMANTIC_PAINT_OVERRIDE' },
      { code: 'UNBOUNDED_SEMANTIC_PAINT_OVERRIDE' },
    ]);
  });

  it('allows application-owned layout and geometry', () => {
    expect(audit(`
      .test-domain .peaks-presentation-state-list-button {
        width: 100%;
        min-height: 70px;
        padding: 8px;
        gap: 5px;
      }
    `)).toEqual([]);
  });

  it('allows the official Foundation primitive paint capability', () => {
    expect(audit(`
      .peaks-presentation-state-list-button {
        color: var(--peaks-presentation-text);
        background: var(--peaks-presentation-background);
        border-color: var(--peaks-presentation-border);
      }
    `, 'src/foundation/presentation/primitives/primitives.css')).toEqual([]);
  });
});
