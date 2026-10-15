import type { PeaksCssVariableReference } from './colors';

const css = <TName extends `--peaks-${string}`>(
  name: TName,
): `var(${TName})` => `var(${name})`;

export const PEAKS_TYPOGRAPHY_TOKENS: Readonly<Record<string, PeaksCssVariableReference | Readonly<Record<string, PeaksCssVariableReference>>>> = Object.freeze({
  actions: Object.freeze({
    action: css('--peaks-action-font-size'),
    fixedAction: css('--peaks-fixed-action-font-size'),
    listMain: css('--peaks-list-main-font-size'),
    listSecondary: css('--peaks-list-secondary-font-size'),
  }),
  information: Object.freeze({
    text: css('--peaks-info-text-font-size'),
    card: css('--peaks-production-card-font-size'),
    message: css('--peaks-message-text-font-size'),
  }),
  inputs: Object.freeze({
    numericDisplay: css('--peaks-numeric-display-font-size'),
    numericKey: css('--peaks-numeric-key-font-size'),
    numericControl: css('--peaks-numeric-control-font-size'),
    comment: css('--peaks-comment-input-font-size'),
    commentHelper: css('--peaks-comment-helper-font-size'),
  }),
});
