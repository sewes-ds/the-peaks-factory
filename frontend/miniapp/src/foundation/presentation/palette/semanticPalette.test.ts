import { describe, expect, it } from 'vitest';
import { PEAKS_COLOR_TOKENS } from '../tokens';
import { resolvePresentationBorderToken, resolvePresentationFillToken, resolvePresentationTextToken } from './semanticPalette';

describe('shared semantic palette', () => {
  it('resolves the authoritative physical tokens', () => {
    expect(resolvePresentationFillToken('solid', 'info')).toBe(PEAKS_COLOR_TOKENS.brand.blue);
    expect(resolvePresentationFillToken('soft', 'positive')).toBe(PEAKS_COLOR_TOKENS.brand.lightGreen);
    expect(resolvePresentationFillToken('outline', 'danger')).toBe(PEAKS_COLOR_TOKENS.brand.white);
    expect(resolvePresentationFillToken('transparent', 'neutral')).toBe('transparent');
    expect(resolvePresentationBorderToken('warning')).toBe(PEAKS_COLOR_TOKENS.yellow.border);
    expect(resolvePresentationTextToken('inactive')).toBe(PEAKS_COLOR_TOKENS.foundation.muted);
  });
});
