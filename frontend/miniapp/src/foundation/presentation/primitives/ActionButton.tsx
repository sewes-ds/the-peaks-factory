import type { ReactNode } from 'react';

import type { ControlFeedbackPresentation } from '../feedback';
import {
  assertControlSurface,
  interactiveHandler,
  type ActionButtonControlPresentation,
} from './contracts';
import { controlPresentationStyle } from './style';

export type PresentationActionButtonProps = Readonly<{
  presentation: ActionButtonControlPresentation;
  feedback: ControlFeedbackPresentation;
  label: ReactNode;
  ariaLabel?: string;
  onPress?: () => void;
}>;

export function PresentationActionButton({
  presentation,
  feedback,
  label,
  ariaLabel,
  onPress,
}: PresentationActionButtonProps) {
  assertControlSurface(presentation, 'action-button');
  const onClick = interactiveHandler(feedback, onPress);
  const classes = [
    'peaks-presentation-action-button',
    feedback.visualTreatment === 'muted'
      ? 'peaks-presentation-feedback--muted'
      : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      aria-busy={feedback.ariaBusy}
      aria-disabled={feedback.ariaDisabled}
      aria-label={ariaLabel}
      aria-live={feedback.live}
      className={classes}
      data-availability={feedback.availability}
      data-control-key={presentation.key}
      disabled={feedback.nativeDisabled}
      style={controlPresentationStyle(presentation)}
      type="button"
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        className="peaks-presentation-action-button__leading-slot"
      >
        {feedback.progress === 'spinner' ? (
          <span className="peaks-presentation-spinner" />
        ) : null}
      </span>
      <span className="peaks-presentation-action-button__label">
        {label}
      </span>
    </button>
  );
}
