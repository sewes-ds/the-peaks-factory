import type { ReactNode } from 'react';

import type { ControlFeedbackPresentation } from '../feedback';
import {
  assertStateSurface,
  interactiveHandler,
  type EntityRowStatePresentation,
} from './contracts';
import { statePresentationStyle } from './style';

export type PresentationEntityRowProps = Readonly<{
  presentation: EntityRowStatePresentation;
  feedback: ControlFeedbackPresentation;
  primary: ReactNode;
  secondary?: ReactNode;
  ariaLabel?: string;
  onPress?: () => void;
}>;

export function PresentationEntityRow({
  presentation,
  feedback,
  primary,
  secondary,
  ariaLabel,
  onPress,
}: PresentationEntityRowProps) {
  assertStateSurface(presentation, 'entity-row');
  const onClick = interactiveHandler(feedback, onPress);
  const classes = [
    'peaks-presentation-entity-row',
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
      <span className="peaks-presentation-entity-row__content">
        <span className="peaks-presentation-entity-row__primary">
          {primary}
        </span>
        {secondary !== undefined ? (
          <span className="peaks-presentation-entity-row__secondary">
            {secondary}
          </span>
        ) : null}
      </span>
      {feedback.progress === 'spinner' ? (
        <span
          aria-hidden="true"
          className="peaks-presentation-spinner"
        />
      ) : null}
    </button>
  );
}
