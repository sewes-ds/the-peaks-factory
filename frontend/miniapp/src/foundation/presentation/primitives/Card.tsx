import type { ReactNode } from 'react';

import type { ControlFeedbackPresentation } from '../feedback';
import {
  assertCardLines,
  assertStateSurface,
  interactiveHandler,
  type CardStatePresentation,
  type PresentationCardLine,
} from './contracts';
import { statePresentationStyle } from './style';

type PresentationCardBaseProps = Readonly<{
  presentation: CardStatePresentation;
  title?: ReactNode;
  lines: readonly PresentationCardLine[];
  ariaLabel?: string;
}>;

export type PresentationCardProps = PresentationCardBaseProps & (
  | Readonly<{ feedback?: never; onPress?: never }>
  | Readonly<{ feedback: ControlFeedbackPresentation; onPress?: () => void }>
);

export function PresentationCard({
  presentation,
  title,
  lines,
  ariaLabel,
  feedback,
  onPress,
}: PresentationCardProps) {
  assertStateSurface(presentation, 'card');
  assertCardLines(lines);

  const content = (
    <>
      {title !== undefined ? (
        <div className="peaks-presentation-card__title">{title}</div>
      ) : null}
      <div className="peaks-presentation-card__lines">
        {lines.map((line, index) => (
          'content' in line
            ? (
              <div
                className="peaks-presentation-card__line peaks-presentation-card__line--content"
                key={index}
              >
                <span className="peaks-presentation-card__content">
                  {line.content}
                </span>
              </div>
            )
            : (
              <div className="peaks-presentation-card__line" key={index}>
                <span className="peaks-presentation-card__label">
                  {line.label}
                </span>
                <span className="peaks-presentation-card__value">
                  {line.value}
                </span>
              </div>
          )
        ))}
      </div>
    </>
  );

  if (feedback === undefined || feedback.availability === 'inert') {
    if (onPress !== undefined) {
      throw new Error('Interactive card handler requires interactive feedback.');
    }
    return (
      <section
        aria-label={ariaLabel}
        className="peaks-presentation-card"
        data-state-key={presentation.key}
        style={statePresentationStyle(presentation)}
      >
        {content}
      </section>
    );
  }

  const onClick = interactiveHandler(feedback, onPress);
  return (
    <button
      aria-busy={feedback.ariaBusy}
      aria-disabled={feedback.ariaDisabled}
      aria-label={ariaLabel}
      aria-live={feedback.live}
      className="peaks-presentation-card peaks-presentation-card--interactive"
      data-availability={feedback.availability}
      data-state-key={presentation.key}
      disabled={feedback.nativeDisabled}
      style={statePresentationStyle(presentation)}
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}
