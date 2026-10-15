import type { PeaksCssVariableReference } from './colors';

const css = <TName extends `--peaks-${string}`>(
  name: TName,
): `var(${TName})` => `var(${name})`;

export const PEAKS_FEEDBACK_TOKENS: Readonly<
  Record<string, PeaksCssVariableReference>
> = Object.freeze({
  disabledOpacity: css('--peaks-feedback-disabled-opacity'),
  spinnerDuration: css('--peaks-feedback-spinner-duration'),
});
