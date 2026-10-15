import type { ReactNode } from 'react';

import {
  assertStateSurface,
  type MessageStatePresentation,
} from './contracts';
import { statePresentationStyle } from './style';

export type PresentationMessageProps = Readonly<{
  presentation: MessageStatePresentation;
  children: ReactNode;
  ariaLabel?: string;
  role?: 'status' | 'alert';
  ariaLive?: 'polite' | 'assertive';
  ariaBusy?: boolean;
}>;

export function PresentationMessage({
  presentation,
  children,
  ariaLabel,
  role,
  ariaLive,
  ariaBusy,
}: PresentationMessageProps) {
  assertStateSurface(presentation, 'message');

  return (
    <section
      aria-busy={ariaBusy}
      aria-label={ariaLabel}
      aria-live={ariaLive}
      className="peaks-presentation-message"
      data-state-key={presentation.key}
      role={role}
      style={statePresentationStyle(presentation)}
    >
      {children}
    </section>
  );
}
