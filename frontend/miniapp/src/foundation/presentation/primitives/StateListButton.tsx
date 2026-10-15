import type { ReactNode } from 'react';

import type { ControlFeedbackPresentation } from '../feedback';
import {
  assertStateSurface,
  interactiveHandler,
  type ListButtonStatePresentation,
} from './contracts';
import { statePresentationStyle } from './style';

export type PresentationStateListButtonProps = Readonly<{
  presentation: ListButtonStatePresentation;
  feedback: ControlFeedbackPresentation;
  mainLine: ReactNode;
  secondaryLine?: ReactNode;
  ariaLabel?: string;
  onPress?: () => void;
}>;

export function PresentationStateListButton({
  presentation,
  feedback,
  mainLine,
  secondaryLine,
  ariaLabel,
  onPress,
}: PresentationStateListButtonProps) {
  assertStateSurface(presentation, 'list-button');
  const onClick = interactiveHandler(feedback, onPress);
  const classes = [
    'peaks-presentation-state-list-button',
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
      data-state-key={presentation.key}
      disabled={feedback.nativeDisabled}
      style={statePresentationStyle(presentation)}
      type="button"
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        className="peaks-presentation-state-marker"
      />
      {feedback.progress === 'spinner' ? (
        <span
          aria-hidden="true"
          className="peaks-presentation-spinner"
        />
      ) : null}
      <span className="peaks-presentation-state-list-button__main">
        {mainLine}
      </span>
      {secondaryLine !== undefined ? (
        <span className="peaks-presentation-state-list-button__secondary">
          {secondaryLine}
        </span>
      ) : null}
    </button>
  );
}
