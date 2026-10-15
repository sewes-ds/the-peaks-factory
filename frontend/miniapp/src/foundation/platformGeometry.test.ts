import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

function cssFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith('.css') ? [path] : [];
  });
}

describe('PGR-1 platform production-root geometry', () => {
  it('defines deterministic root spacing and sizing without clipping overflow', () => {
    const css = source('src/foundation/platformRoot.css');
    expect(css).toContain('--peaks-platform-root-geometry-contract: PGR-1;');
    expect(css).toMatch(/html\s*\{[\s\S]*?margin: 0;[\s\S]*?padding: 0;[\s\S]*?box-sizing: border-box;/);
    expect(css).toMatch(/body,\s*#root\s*\{[\s\S]*?inline-size: 100%;[\s\S]*?min-inline-size: 0;[\s\S]*?min-block-size: 100dvh;/);
    expect(css).not.toMatch(/overflow(?:-x)?\s*:\s*(?:hidden|clip)/);
  });

  it('uses the exact production normalization authority in both entrypoints', () => {
    expect(source('src/main.tsx')).toContain("import './foundation/platformRoot.css';");
    expect(source('browser-tests/main.tsx')).toContain("import '../src/foundation/platformRoot.css';");
    const browserCss = source('browser-tests/browser.css');
    expect(browserCss).not.toMatch(/(^|\})\s*(?:html|body|#root)\b/m);
    expect(browserCss).not.toMatch(/body\s*\{[^}]*overflow(?:-x)?\s*:\s*(?:hidden|clip)/);
  });

  it('uses container width for normal-flow S01 and shared graph roots', () => {
    const section01 = source('src/section01/section01.css');
    const graphRenderer = source('src/foundation/graphRenderer/graphRenderer.css');
    expect(section01).toMatch(/\.s01-page\s*\{[\s\S]*?width: 100%;/);
    expect(section01).not.toMatch(/\.s01-page\s*\{[\s\S]*?width: 100vw;/);
    expect(graphRenderer).toMatch(/\.peaks-graph-viewport\s*\{[\s\S]*?width: 100%;/);
    expect(graphRenderer).not.toMatch(/\.peaks-graph-viewport\s*\{[\s\S]*?width: 100vw;/);
  });

  it('keeps the viewport-width audit explicit and fail-closed', () => {
    const root = resolve(process.cwd(), 'src');
    const occurrences = cssFiles(root).flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      return lines.flatMap((line, index) => line.includes('100vw')
        ? [`${relative(process.cwd(), file)}:${index + 1}:${line.trim()}`]
        : []);
    });
    expect(occurrences).toHaveLength(2);
    expect(occurrences.every((entry) => entry.startsWith(
      'src/foundation/presentation/templates/templates.css:',
    ))).toBe(true);
    const template = source('src/foundation/presentation/templates/templates.css');
    expect(template).toMatch(/\.peaks-presentation-screen-template\s*\{[\s\S]*?position: fixed;[\s\S]*?inset: 0 auto auto 0;[\s\S]*?width: 100vw;/);
    expect(source('src/section02/section02.css')).not.toContain('100vw');
    expect(source('src/section03/section03.css')).not.toContain('100vw');
  });
});
