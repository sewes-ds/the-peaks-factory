import type { ReactNode } from 'react';

import {
  assertStateSurface,
  type SummaryLineStatePresentation,
} from './contracts';
import { statePresentationStyle } from './style';

export type PresentationSummaryLineProps = Readonly<{
  presentation: SummaryLineStatePresentation;
  children: ReactNode;
  ariaLabel?: string;
}>;

export function PresentationSummaryLine({
  presentation,
  children,
  ariaLabel,
}: PresentationSummaryLineProps) {
  assertStateSurface(presentation, 'summary-line');

  return (
    <div
      aria-label={ariaLabel}
      className="peaks-presentation-summary-line"
      data-state-key={presentation.key}
      style={statePresentationStyle(presentation)}
    >
      {children}
    </div>
  );
}
