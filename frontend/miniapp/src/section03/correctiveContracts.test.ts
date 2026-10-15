import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(
  resolve(process.cwd(), path),
  'utf8',
);

const css = source('src/section03/section03.css');
const template = source('src/foundation/presentation/templates/templates.css');

describe('Section 03 corrective contracts D-164 through D-168', () => {
  it('C1-S03-VIEWPORT-ROOT-01 consumes one shared stable viewport', () => {
    expect(css).toContain('.peaks-section03-screen {');
    expect(template).toContain('height: var(--tg-viewport-stable-height, 100dvh);');
    expect(template).toContain('position: fixed;');
    expect(template).toContain('overflow: hidden;');
    expect(css).not.toContain('position: fixed;');
    expect(css).not.toMatch(/(^|\})\s*(html|body|#root)\b/m);
  });

  it('C1-S03-SCROLL-OWNER-01 locks the single touch and wheel scroll owner', () => {
    expect(template).toMatch(/__scroll\s*\{[\s\S]*?overflow-y: auto;/);
    expect(template).toMatch(/__scroll\s*\{[\s\S]*?touch-action: pan-y;/);
    expect(template).toMatch(/\.peaks-presentation-screen-template\s*\{[\s\S]*?overflow: hidden;/);
  });

  it('C1-S03-FIXED-ZONES-01 locks header, title, footer and their spacing', () => {
    expect(css).toContain('--peaks-s03-content-gap: 7px;');
    expect(css).toContain('--peaks-s03-footer-separation: 6px;');
    expect(css).toMatch(/__fixed-bottom\s*\{[\s\S]*?padding-block-start: var\(--peaks-s03-footer-separation\);/);
    expect(template).toMatch(/__header,[\s\S]*?__fixed-bottom\s*\{[\s\S]*?flex: 0 0 auto;/);
  });

  it('C1-S03-TITLE-01 keeps every projected title centered, blue and fixed', () => {
    expect(css).toMatch(/__title\s*\{[\s\S]*?color: var\(--peaks-blue\);/);
    expect(css).toMatch(/__title\s*\{[\s\S]*?text-align: center;/);
    expect(css).toMatch(/__title\s*\{[\s\S]*?font-weight: 700;/);
    expect(template).toMatch(/__title,[\s\S]*?__fixed-bottom\s*\{[\s\S]*?flex: 0 0 auto;/);
  });

  it('C1-S01-S02-ISOLATION-01 leaves Sections 01 and 02 independently scoped', () => {
    const section01 = source('src/section01/section01.css');
    const section02 = source('src/section02/section02.css');
    expect(section01).toContain('.s01-page {');
    expect(section01).toContain('min-height: 100dvh;');
    expect(section01).toContain('font-family: Arial, Helvetica, sans-serif;');
    expect(section02).not.toContain('.peaks-section03-screen');
    expect(css).not.toMatch(/\.s01-|\.peaks-d2-/);
    expect(source('src/section02/section02.css')).not.toContain('position: fixed;');
  });

  it('C2-S03-LOGO-PARITY-01 restores the accepted 62px logo zone', () => {
    expect(css).toMatch(/\.peaks-section03-header__logo\s*\{[\s\S]*?width: 62px;[\s\S]*?height: 62px;/);
    expect(css).toMatch(/\.peaks-section03-header\s*\{[\s\S]*?padding-block-start: 4px;/);
    expect(template).toContain('padding-block-start: var(--peaks-screen-safe-top);');
  });

  it('C2-S03-FONT-ASSET-01 pins local OFL Arimo assets and deterministic weights', () => {
    const fonts = [
      ['src/assets/fonts/arimo-cyrillic-v36.woff2', 13_340, '12a472a87e335eda68eca7c1af94e564f09df8b53118560fa64c823b8bba1ee2'],
      ['src/assets/fonts/arimo-latin-v36.woff2', 20_132, '6a22ce0b2709c7e856a8bd9bbf31b0f7695caeeeb03915b0212d6d959e9bc1b9'],
    ] as const;
    for (const [path, bytes, sha256] of fonts) {
      const absolute = resolve(process.cwd(), path);
      expect(statSync(absolute).size).toBe(bytes);
      expect(createHash('sha256').update(readFileSync(absolute)).digest('hex'))
        .toBe(sha256);
    }
    expect(source('public/assets/fonts/Arimo-OFL.txt'))
      .toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(css).toContain("font-family: 'Peaks Arimo'");
    expect(css).toContain('font-weight: 400 700;');
    expect(css).toContain('font-display: block;');
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('PFR-S03-RESOURCE-01 keeps ownership split between descriptor and platform lifecycle', () => {
    const typography = source('src/section03/typography.ts');
    const platform = source('src/foundation/fontReadiness.ts');
    const host = source('src/section03/Section03Host.tsx');
    expect(typography).toContain("resourceId: 'SECTION03_ARIMO_LOCAL_V36'");
    expect(typography).toContain('slowThresholdMs: SECTION03_FONT_SLOW_THRESHOLD_MS');
    expect(typography).not.toMatch(/Promise\.race|FONT_LOAD_TIMEOUT/);
    expect(platform).toContain("'SLOW'");
    expect(platform).toContain("'READY_AFTER_RETRY'");
    expect(platform).toContain("retryUrl.searchParams.set('peaks-font-attempt'");
    expect(host).toContain('resolvePlatformFontReadinessFeedback');
    expect(host).not.toContain('ensureSection03TypographyReady');
    expect(css).toMatch(/\.peaks-section03-screen\.peaks-section03-system-shell\s*\{[\s\S]*?font-family: Arial, Helvetica, sans-serif;/);
  });

  it('C2-S03-FONT-METRICS-01 pins the accepted Legacy-metric specimen', () => {
    const metrics = JSON.parse(source(
      'test-contracts/section03-typography-metrics.json',
    )) as {
      total_woff2_bytes: number;
      canvas_widths_px_700_22: readonly { delta: number }[];
      dom_block_heights_px_at_300_width: readonly { arimo: number; legacy_stack: number }[];
      horizontal_overflow_samples: number;
      render_environment: { cumulative_layout_shift: number };
    };
    expect(metrics.total_woff2_bytes).toBe(33_472);
    expect(metrics.canvas_widths_px_700_22.every(({ delta }) => delta === 0)).toBe(true);
    expect(metrics.dom_block_heights_px_at_300_width.every(
      ({ arimo, legacy_stack }) => arimo === legacy_stack,
    )).toBe(true);
    expect(metrics.horizontal_overflow_samples).toBe(0);
    expect(metrics.render_environment.cumulative_layout_shift).toBe(0);
  });

  it('C3-S03-DETAIL-CARD-01 uses the systemic vertical label/value recipe', () => {
    expect(css).toMatch(/__label\s*\{[\s\S]*?display: block;[\s\S]*?text-decoration: underline;/);
    expect(css).toMatch(/__value\s*\{[\s\S]*?display: block;/);
  });

  it('C3-S03-AW-GROUP-HEADING-01 uses an unframed systemic summary primitive', () => {
    const summaryRule = css.match(
      /\.peaks-section03-screen \.peaks-presentation-summary-line\s*\{[^}]*\}/,
    )?.[0];
    expect(summaryRule).toContain('padding: 2px 2px 0;');
    expect(summaryRule).not.toMatch(
      /\b(?:color|background(?:-color)?|border(?:-color)?)\s*:/,
    );
    expect(css).toMatch(/\.peaks-section03-screen \.peaks-presentation-state-marker\s*\{[\s\S]*?display: none;/);
  });

  it('keeps legacy ФИО out of every Section 03 projection source', () => {
    const projectionDirectory = resolve(process.cwd(), 'src/section03/projections');
    const productionSources = readdirSync(projectionDirectory)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => readFileSync(resolve(projectionDirectory, file), 'utf8'));
    expect(productionSources.join('\n')).not.toMatch(/['"`]ФИО['"`]/);
  });
});
