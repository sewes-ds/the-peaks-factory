import {
  type PresentationFillMode,
  type PresentationTextTone,
  type PresentationTone,
} from '../model';
import {
  PEAKS_COLOR_TOKENS,
  type PeaksCssVariableReference,
} from '../tokens';

export type PresentationPaintToken = PeaksCssVariableReference | 'transparent';

const solidFillTokens: Readonly<Record<PresentationTone, PeaksCssVariableReference>> = Object.freeze({
  info: PEAKS_COLOR_TOKENS.brand.blue,
  positive: PEAKS_COLOR_TOKENS.brand.green,
  warning: PEAKS_COLOR_TOKENS.yellow.fill,
  danger: PEAKS_COLOR_TOKENS.red.fill,
  neutral: PEAKS_COLOR_TOKENS.gray.fill,
  inactive: PEAKS_COLOR_TOKENS.gray.fill,
});

const softFillTokens: Readonly<Record<PresentationTone, PeaksCssVariableReference>> = Object.freeze({
  info: PEAKS_COLOR_TOKENS.brand.lightBlue,
  positive: PEAKS_COLOR_TOKENS.brand.lightGreen,
  warning: PEAKS_COLOR_TOKENS.yellow.fill,
  danger: PEAKS_COLOR_TOKENS.red.fill,
  neutral: PEAKS_COLOR_TOKENS.gray.fill,
  inactive: PEAKS_COLOR_TOKENS.gray.fill,
});

const borderTokens: Readonly<Record<PresentationTone, PeaksCssVariableReference>> = Object.freeze({
  info: PEAKS_COLOR_TOKENS.brand.blue,
  positive: PEAKS_COLOR_TOKENS.brand.green,
  warning: PEAKS_COLOR_TOKENS.yellow.border,
  danger: PEAKS_COLOR_TOKENS.red.border,
  neutral: PEAKS_COLOR_TOKENS.gray.border,
  inactive: PEAKS_COLOR_TOKENS.gray.border,
});

const textTokens: Readonly<Record<PresentationTextTone, PeaksCssVariableReference>> = Object.freeze({
  info: PEAKS_COLOR_TOKENS.brand.blue,
  positive: PEAKS_COLOR_TOKENS.brand.green,
  warning: PEAKS_COLOR_TOKENS.yellow.text,
  danger: PEAKS_COLOR_TOKENS.red.text,
  neutral: PEAKS_COLOR_TOKENS.gray.text,
  inactive: PEAKS_COLOR_TOKENS.foundation.muted,
  inverse: PEAKS_COLOR_TOKENS.brand.white,
  muted: PEAKS_COLOR_TOKENS.foundation.muted,
});

export function resolvePresentationFillToken(
  mode: PresentationFillMode,
  tone: PresentationTone,
): PresentationPaintToken {
  if (mode === 'solid') return solidFillTokens[tone];
  if (mode === 'soft') return softFillTokens[tone];
  if (mode === 'outline') return PEAKS_COLOR_TOKENS.brand.white;
  return 'transparent';
}

export function resolvePresentationBorderToken(
  tone: PresentationTone,
): PeaksCssVariableReference {
  return borderTokens[tone];
}

export function resolvePresentationTextToken(
  tone: PresentationTextTone,
): PeaksCssVariableReference {
  return textTokens[tone];
}
