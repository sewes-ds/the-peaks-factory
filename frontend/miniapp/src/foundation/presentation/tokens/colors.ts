export type PeaksCssVariableReference = `var(--peaks-${string})`;

const css = <TName extends `--peaks-${string}`>(
  name: TName,
): `var(${TName})` => `var(${name})`;

export const PEAKS_COLOR_TOKENS = Object.freeze({
  brand: Object.freeze({
    blue: css('--peaks-blue'),
    white: css('--peaks-white'),
    lightBlue: css('--peaks-light-blue'),
    blueSoft: css('--peaks-blue-soft'),
    green: css('--peaks-green'),
    lightGreen: css('--peaks-light-green'),
  }),
  yellow: Object.freeze({
    border: css('--peaks-yellow-border'),
    fill: css('--peaks-yellow-fill'),
    text: css('--peaks-yellow-text'),
  }),
  gray: Object.freeze({
    border: css('--peaks-gray-border'),
    fill: css('--peaks-gray-fill'),
    text: css('--peaks-gray-text'),
  }),
  red: Object.freeze({
    border: css('--peaks-red-border'),
    fill: css('--peaks-red-fill'),
    text: css('--peaks-red-text'),
  }),
  compatibility: Object.freeze({
    successText: css('--peaks-success-text'),
    successBackground: css('--peaks-success-bg'),
    warningText: css('--peaks-warning-text'),
    warningBorder: css('--peaks-warning-border'),
    warningBackground: css('--peaks-warning-bg'),
    criticalText: css('--peaks-critical-text'),
    criticalBorder: css('--peaks-critical-border'),
    criticalBackground: css('--peaks-critical-bg'),
    neutralText: css('--peaks-neutral-text'),
    neutralBorder: css('--peaks-neutral-border'),
    neutralBackground: css('--peaks-neutral-bg'),
  }),
  foundation: Object.freeze({
    ink: css('--peaks-ink'),
    muted: css('--peaks-muted'),
    surface: css('--peaks-surface'),
    background: css('--peaks-background'),
    line: css('--peaks-line'),
  }),
});
