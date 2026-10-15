import type { ReactNode } from 'react';

import type {
  ContentFeedbackPresentation,
  ControlFeedbackPresentation,
} from '../feedback';
import { PresentationActionButton } from './ActionButton';
import {
  assertContentFeedback,
  retryHandler,
  type ActionButtonControlPresentation,
  type MessageStatePresentation,
} from './contracts';
import { PresentationMessage } from './Message';

export type PresentationFeedbackBlockProps = Readonly<{
  presentation: ContentFeedbackPresentation;
  message: ReactNode;
  retryLabel?: ReactNode;
  retryFeedback?: ControlFeedbackPresentation;
  onRetry?: () => void;
}>;

export function PresentationFeedbackBlock({
  presentation,
  message,
  retryLabel,
  retryFeedback,
  onRetry,
}: PresentationFeedbackBlockProps) {
  assertContentFeedback(presentation);
  const retryOnPress = retryHandler(
    presentation,
    retryLabel,
    retryFeedback,
    onRetry,
  );

  return (
    <section
      className="peaks-presentation-feedback-block"
      data-feedback-kind={presentation.kind}
    >
      <PresentationMessage
        ariaBusy={presentation.ariaBusy}
        ariaLive={presentation.ariaLive}
        presentation={presentation.state as MessageStatePresentation}
        role={presentation.ariaRole}
      >
        {presentation.kind === 'loading' ? (
          <span
            aria-hidden="true"
            className="peaks-presentation-spinner"
          />
        ) : null}
        {message}
      </PresentationMessage>
      {presentation.retryControl !== null &&
      retryLabel !== undefined &&
      retryFeedback !== undefined ? (
        <PresentationActionButton
          feedback={retryFeedback}
          label={retryLabel}
          presentation={
            presentation.retryControl as ActionButtonControlPresentation
          }
          onPress={retryOnPress}
        />
      ) : null}
    </section>
  );
}
