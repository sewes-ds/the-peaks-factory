import type { ReactNode } from 'react';

import type { ControlFeedbackPresentation } from '../feedback';
import {
  assertControlSurface,
  interactiveHandler,
  type ListButtonControlPresentation,
} from './contracts';
import { controlPresentationStyle } from './style';

export type PresentationControlListButtonProps = Readonly<{
  presentation: ListButtonControlPresentation;
  feedback: ControlFeedbackPresentation;
  mainLine: ReactNode;
  secondaryLine?: ReactNode;
  ariaLabel?: string;
  onPress?: () => void;
}>;

export function PresentationControlListButton({
  presentation,
  feedback,
  mainLine,
  secondaryLine,
  ariaLabel,
  onPress,
}: PresentationControlListButtonProps) {
  assertControlSurface(presentation, 'list-button');
  const onClick = interactiveHandler(feedback, onPress);
  const classes = [
    'peaks-presentation-control-list-button',
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
      {feedback.progress === 'spinner' ? (
        <span
          aria-hidden="true"
          className="peaks-presentation-spinner"
        />
      ) : null}
      <span className="peaks-presentation-control-list-button__main">
        {mainLine}
      </span>
      {secondaryLine !== undefined ? (
        <span className="peaks-presentation-control-list-button__secondary">
          {secondaryLine}
        </span>
      ) : null}
    </button>
  );
}
