import { resolveControlPresentation } from '../controls';
import {
  resolveContentFeedback,
  resolveControlFeedback,
} from '../feedback';
import { resolveStatePresentation } from '../states';
import type { PresentationActionButtonProps } from './ActionButton';
import type { PresentationCardProps } from './Card';
import type {
  ActionButtonControlPresentation,
  CardStatePresentation,
} from './contracts';

const action = resolveControlPresentation({
  key: 'action-neutral',
  surface: 'action-button',
}) as ActionButtonControlPresentation;
const card = resolveStatePresentation({
  key: 'state-info',
  surface: 'card',
}) as CardStatePresentation;
const enabled = resolveControlFeedback({
  availability: 'enabled',
  preserveToneWhenDisabled: false,
});
const content = resolveContentFeedback({ kind: 'loading' });

const validAction: PresentationActionButtonProps = {
  presentation: action,
  feedback: enabled,
  label: 'Label',
  onPress: () => undefined,
};

const invalidClass: PresentationActionButtonProps = {
  presentation: action,
  feedback: enabled,
  label: 'Label',
  onPress: () => undefined,
  // @ts-expect-error caller class overrides are forbidden
  className: 'custom',
};

const invalidState: PresentationActionButtonProps = {
  // @ts-expect-error state presentations cannot drive control primitives
  presentation: card,
  feedback: enabled,
  label: 'Label',
};

const validCard: PresentationCardProps = {
  presentation: card,
  lines: [
    { content: 'Content only' },
    { label: 'Label', value: 'Value' },
  ],
};

// @ts-expect-error non-interactive cards expose no callback
const invalidCardHandler: PresentationCardProps = {
  presentation: card,
  lines: [{ label: 'Label', value: 'Value' }],
  onPress: () => undefined,
};

// @ts-expect-error no raw icon support in WP4
validAction.icon = 'icon.svg';
// @ts-expect-error content feedback is not control feedback
validAction.feedback = content;

void invalidClass;
void invalidState;
void validCard;
void invalidCardHandler;
