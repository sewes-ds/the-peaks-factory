import type { CSSProperties } from 'react';

import type { ControlPresentation } from '../controls';
import type { StatePresentation } from '../states';

type PresentationStyle = CSSProperties & Readonly<{
  '--peaks-presentation-background': string;
  '--peaks-presentation-border': string;
  '--peaks-presentation-text': string;
  '--peaks-presentation-marker': string;
}>;

export function controlPresentationStyle(
  presentation: ControlPresentation,
): PresentationStyle {
  return Object.freeze({
    '--peaks-presentation-background': presentation.tokens.background,
    '--peaks-presentation-border': presentation.tokens.border,
    '--peaks-presentation-text': presentation.tokens.text,
    '--peaks-presentation-marker': presentation.tokens.border,
  });
}

export function statePresentationStyle(
  presentation: StatePresentation,
): PresentationStyle {
  return Object.freeze({
    '--peaks-presentation-background': presentation.tokens.background,
    '--peaks-presentation-border': presentation.tokens.border,
    '--peaks-presentation-text': presentation.tokens.text,
    '--peaks-presentation-marker': presentation.tokens.marker,
  });
}
