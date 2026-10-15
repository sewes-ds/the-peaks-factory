import type { PeaksCssVariableReference } from './colors';

const css = <TName extends `--peaks-${string}`>(
  name: TName,
): `var(${TName})` => `var(${name})`;

export const PEAKS_INPUT_TOKENS: Readonly<Record<string, PeaksCssVariableReference | Readonly<Record<string, PeaksCssVariableReference>>>> = Object.freeze({
  numericKeyboard: Object.freeze({
    objectGap: css('--peaks-numeric-object-gap'),
    displayHeight: css('--peaks-numeric-display-height'),
    keyGap: css('--peaks-numeric-key-gap'),
    keyHeight: css('--peaks-numeric-key-height'),
  }),
  comment: Object.freeze({
    minHeight: css('--peaks-comment-input-min-height'),
    maxHeight: css('--peaks-comment-input-max-height'),
  }),
});
