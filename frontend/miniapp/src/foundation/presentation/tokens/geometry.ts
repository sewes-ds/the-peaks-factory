import type { PeaksCssVariableReference } from './colors';

const css = <TName extends `--peaks-${string}`>(
  name: TName,
): `var(${TName})` => `var(${name})`;

export const PEAKS_GEOMETRY_TOKENS: Readonly<Record<string, PeaksCssVariableReference | Readonly<Record<string, PeaksCssVariableReference>>>> = Object.freeze({
  viewport: Object.freeze({
    sidePadding: css('--peaks-side-padding'),
    gap: css('--peaks-gap'),
    fixedGap: css('--peaks-fixed-gap'),
    bottomPadding: css('--peaks-bottom-padding'),
  }),
  logo: Object.freeze({
    size: css('--peaks-logo-size'),
    topPadding: css('--peaks-logo-top-padding'),
    bottomGap: css('--peaks-logo-bottom-gap'),
    areaHeight: css('--peaks-logo-area-height'),
  }),
  actions: Object.freeze({
    actionHeight: css('--peaks-action-height'),
    fixedHeight: css('--peaks-fixed-height'),
    radius: css('--peaks-button-radius'),
    border: css('--peaks-button-border'),
  }),
  icons: Object.freeze({
    slotWidth: css('--peaks-icon-slot-width'),
    size: css('--peaks-icon-size'),
  }),
  information: Object.freeze({
    textMinHeight: css('--peaks-info-text-min-height'),
    cardMinHeight: css('--peaks-production-card-min-height'),
  }),
  bottomActions: Object.freeze({
    height: css('--peaks-bottom-action-height'),
    regularHeight: css('--peaks-regular-action-height'),
    radius: css('--peaks-radius'),
  }),
});
